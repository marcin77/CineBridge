import { getSetting } from "@/lib/settings";
import { tmdbFetchJson } from "@/lib/tmdb-fetch";

export interface TmdbResult {
  tmdbId: string;
  imdbId: string | null;
  title: string;
  originalTitle: string;
  year: number | null;
  type: "movie" | "show";
}

async function getApiKey(): Promise<string | null> {
  return process.env.TMDB_API_KEY ?? (await getSetting("tmdb_api_key"));
}


async function tmdbSearchResults(
  apiKey: string,
  endpoint: "movie" | "tv",
  query: string,
  year: number | null,
  language?: string,
): Promise<Record<string, unknown>[]> {
  const params = new URLSearchParams({
    api_key: apiKey,
    query,
    ...(language ? { language } : {}),
    ...(year
      ? { [endpoint === "tv" ? "first_air_date_year" : "year"]: String(year) }
      : {}),
  });

  const data = await tmdbFetchJson(`https://api.themoviedb.org/3/search/${endpoint}?${params}`);
  return (data?.results as Record<string, unknown>[]) ?? [];
}

async function getExternalIds(
  apiKey: string,
  endpoint: "movie" | "tv",
  tmdbId: number,
): Promise<{ imdb_id?: string }> {
  const data = await tmdbFetchJson(
    `https://api.themoviedb.org/3/${endpoint}/${tmdbId}/external_ids?api_key=${apiKey}`,
  );
  return data ?? {};
}

// ── Weryfikacja po reżyserze ────────────────────────────────────────────────

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Filmweb zapisuje wielu reżyserów jako "Jan Kowalski; Anna Nowak" */
export function parseDirectors(directorField: string | null | undefined): string[] {
  if (!directorField) return [];
  return directorField
    .split(/[;,]/)
    .map((d) => normalizeName(d))
    .filter((d) => d.length > 0);
}

/**
 * Rozbija znormalizowane imię i nazwisko na tokeny. Nazwisko to zawsze
 * ostatni token. Pierwszy token może być pełnym imieniem lub inicjałem —
 * Filmweb i TMDB czasem zapisują to inaczej (np. "J.A. Bayona" po
 * normalizacji → "ja bayona" jeden token, a TMDB "J. A. Bayona" →
 * "j a bayona" dwa tokeny). Bierzemy tylko pierwszą literę pierwszego
 * tokenu do porównania, żeby obie formy się zgadzały.
 */
function nameTokens(normalized: string): { firstInitial: string; last: string } {
  const parts = normalized.split(" ").filter(Boolean);
  return {
    firstInitial: parts[0]?.[0] ?? "",
    last: parts[parts.length - 1] ?? "",
  };
}

export function directorsOverlap(fwDirectors: string[], tmdbDirectors: string[]): boolean {
  if (fwDirectors.length === 0 || tmdbDirectors.length === 0) return false;

  for (const fw of fwDirectors) {
    for (const tmdb of tmdbDirectors) {
      if (fw === tmdb) return true;

      const fwT = nameTokens(fw);
      const tmdbT = nameTokens(tmdb);
      if (
        fwT.last.length > 2 &&
        fwT.last === tmdbT.last &&
        fwT.firstInitial &&
        fwT.firstInitial === tmdbT.firstInitial
      ) {
        return true;
      }
    }
  }
  return false;
}

export async function getTmdbDirectors(
  apiKey: string,
  endpoint: "movie" | "tv",
  tmdbId: number,
): Promise<string[]> {
  const creditsEndpoint = endpoint === "tv" ? "aggregate_credits" : "credits";
  const data = await tmdbFetchJson(
    `https://api.themoviedb.org/3/${endpoint}/${tmdbId}/${creditsEndpoint}?api_key=${apiKey}`,
  );
  if (!data) return [];
  const crew = (data.crew as Array<Record<string, unknown>>) ?? [];

  const directors: string[] = [];
  for (const c of crew) {
    const name = c.name as string | undefined;
    if (!name) continue;
    if (endpoint === "movie") {
      if (c.job === "Director") directors.push(normalizeName(name));
    } else {
      const jobs = (c.jobs as Array<{ job?: string }>) ?? [];
      if (jobs.some((j) => j.job === "Director") || c.department === "Directing") {
        directors.push(normalizeName(name));
      }
    }
  }
  return directors;
}

export function resultYear(result: Record<string, unknown>): number | null {
  const date = (result.release_date ?? result.first_air_date) as string | undefined;
  return date ? Number(date.slice(0, 4)) : null;
}

/**
 * Spośród kilku wyników wyszukiwania wybiera ten, którego reżyser
 * pokrywa się z reżyserem z Filmweba. Jeśli brak danych o reżyserze
 * (z Filmweba lub z TMDB) albo żaden kandydat nie pasuje — zachowuje
 * dotychczasowe zachowanie (pierwszy wynik wg rankingu TMDB), żeby nie
 * pogarszać trafności tam, gdzie nie da się zweryfikować.
 */
/**
 * Sprawdza czy KTÓRYKOLWIEK z podanych kandydatów (max 5) ma reżysera
 * pokrywającego się z Filmwebem. Zwraca null (nie fallback!) jeśli żaden
 * nie pasuje — pozwala to wołającemu spróbować KOLEJNEJ strategii
 * wyszukiwania zamiast poddawać się na pierwszym niepasującym zestawie.
 */
async function findDirectorConfirmed(
  apiKey: string,
  endpoint: "movie" | "tv",
  results: Record<string, unknown>[],
  fwDirectors: string[],
  budget: { remaining: number },
  checkedIds: Set<number>,
  year: number | null, // ← NOWY parametr
): Promise<Record<string, unknown> | null> {
  const candidates = results.slice(0, 5);
  for (const cand of candidates) {
    const id = cand.id as number;
    if (checkedIds.has(id)) continue;
    if (budget.remaining <= 0) break;

    budget.remaining--;
    checkedIds.add(id);

    const tmdbDirectors = await getTmdbDirectors(apiKey, endpoint, id);
    if (!directorsOverlap(fwDirectors, tmdbDirectors)) continue;

    // Reżyser się zgadza, ale w antologiach (np. Ryan Murphy: "Potwory")
    // ta sama ekipa kręci różne, niepowiązane instalacje — bez sprawdzenia
    // roku dopasowanie reżysera fałszywie potwierdza zupełnie inny sezon
    // (Dahmer 2022 vs Menendez Story 2024). Tolerancja ±1 rok, spójna
    // z findByDirectorFilmography.
    const candYear = resultYear(cand);
    if (year !== null && candYear !== null && Math.abs(candYear - year) > 1) {
      // console.log(`[DEBUG searchTmdb] reżyser pasuje, rok nie (cand=${candYear} szukany=${year}), odrzucam id=${id}`);
      continue;
    }

    return cand;
  }
  return null;
}

async function findByDirectorFilmography(
  apiKey: string,
  endpoint: "movie" | "tv",
  directorNames: string[],
  year: number | null,
): Promise<Record<string, unknown> | null> {
  for (const rawName of directorNames) {
    const searchRes = await tmdbFetchJson(
      `https://api.themoviedb.org/3/search/person?api_key=${apiKey}&query=${encodeURIComponent(rawName)}`,
    );
    const people = (searchRes?.results as Array<{ id: number }>) ?? [];
    if (people.length === 0) continue;

    const creditsEndpoint = endpoint === "tv" ? "tv_credits" : "movie_credits";
    const credits = await tmdbFetchJson(
      `https://api.themoviedb.org/3/person/${people[0].id}/${creditsEndpoint}?api_key=${apiKey}`,
    );
    const crewList = (credits?.crew as Array<Record<string, unknown>>) ?? [];
    const directed = crewList.filter((c) =>
      endpoint === "movie" ? c.job === "Director" : c.department === "Directing",
    );

    if (!year) {
      if (directed.length > 0) return directed[0];
      continue;
    }

    const match = directed.find((c) => {
      const date = (c.release_date ?? c.first_air_date) as string | undefined;
      if (!date) return false;
      const y = Number(date.slice(0, 4));
      return Math.abs(y - year) <= 1;
    });
    if (match) return match;
  }
  return null;
}

/**
 * Prosta heurystyka: TMDB czasem indeksuje anglojęzyczne tytuły seriali
 * w liczbie pojedynczej, podczas gdy Filmweb (lub inne źródło) podaje
 * tytuł w liczbie mnogiej (np. "Monsters" vs prawdziwy tytuł "Monster").
 * Usuwamy końcowe "s", żeby spróbować też tego wariantu. Celowo prosta
 * i bezpieczna — działa tylko jako DODATKOWA strategia, nigdy nie
 * zastępuje oryginalnego zapytania.
 */
export function singularize(t: string): string | null {
  if (t.length > 3 && t.toLowerCase().endsWith("s") && !t.toLowerCase().endsWith("ss")) {
    return t.slice(0, -1).trim();
  }
  return null;
}

function buildResult(
  result: Record<string, unknown>,
  extData: { imdb_id?: string },
  type: "movie" | "show",
  title: string,
): TmdbResult {
  return {
    tmdbId: String(result.id),
    imdbId: extData.imdb_id ?? null,
    title: (type === "show" ? result.name : result.title) as string ?? title,
    originalTitle: (type === "show" ? result.original_name : result.original_title) as string ?? title,
    year: resultYear(result),
    type,
  };
}

export async function searchTmdb(
  title: string,
  year: number | null,
  type: "movie" | "show",
  originalTitle?: string | null,
  director?: string | null,
): Promise<TmdbResult | null> {
  // console.log(`[DEBUG searchTmdb v2] title=${title} year=${year} director=${director}`);
  const apiKey = await getApiKey();
  if (!apiKey) return null;

  const sanitize = (t: string) =>
    t
      .replace(/²/g, "2")
      .replace(/³/g, "3")
      .replace(/¹/g, "1")
      .replace(/[®™©°•·]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  title = sanitize(title);
  if (originalTitle) originalTitle = sanitize(originalTitle);

  const endpoint = type === "show" ? "tv" : "movie";
  const fwDirectors = parseDirectors(director);

  const titlesToTry = [
    ...new Set(
      [title, originalTitle].filter((t): t is string => !!t && t.trim() !== "")
    ),
  ];

  const shortTitle = (t: string): string | null => {
    const colonIdx = t.indexOf(":");
    if (colonIdx === -1) return null;
    const sub = t.slice(colonIdx + 1).trim();
    if (sub.split(/\s+/).length < 2) return null;
    return t.slice(0, colonIdx).trim();
  };

  const short0 = shortTitle(titlesToTry[0]);
  const short1 = titlesToTry[1] ? shortTitle(titlesToTry[1]) : null;
  const singular0 = singularize(titlesToTry[0]);
  const singular1 = titlesToTry[1] ? singularize(titlesToTry[1]) : null;

  const strategies: Array<() => Promise<Record<string, unknown>[]>> = [
    ...(titlesToTry[1]
      ? [() => tmdbSearchResults(apiKey, endpoint, titlesToTry[1], year)]
      : []),
    ...(titlesToTry[1] && year
      ? [() => tmdbSearchResults(apiKey, endpoint, titlesToTry[1], null)]
      : []),
    () => tmdbSearchResults(apiKey, endpoint, titlesToTry[0], year),
    ...(year ? [() => tmdbSearchResults(apiKey, endpoint, titlesToTry[0], null)] : []),
    ...(short0 ? [() => tmdbSearchResults(apiKey, endpoint, short0, year)] : []),
    ...(short0 && year ? [() => tmdbSearchResults(apiKey, endpoint, short0, null)] : []),
    ...(short1 ? [() => tmdbSearchResults(apiKey, endpoint, short1, year)] : []),
    ...(short1 && year ? [() => tmdbSearchResults(apiKey, endpoint, short1, null)] : []),
    // ── NOWE: wariant liczby pojedynczej (np. "Monster" zamiast "Monsters") ──
    ...(singular1
      ? [() => tmdbSearchResults(apiKey, endpoint, singular1, year)]
      : []),
    ...(singular1 && year
      ? [() => tmdbSearchResults(apiKey, endpoint, singular1, null)]
      : []),
    ...(singular0
      ? [() => tmdbSearchResults(apiKey, endpoint, singular0, year)]
      : []),
    ...(singular0 && year
      ? [() => tmdbSearchResults(apiKey, endpoint, singular0, null)]
      : []),
    () => tmdbSearchResults(apiKey, endpoint, titlesToTry[0], year, "pl-PL"),
    ...(year ? [() => tmdbSearchResults(apiKey, endpoint, titlesToTry[0], null, "pl-PL")] : []),
  ];

  const directorCheckBudget = { remaining: 20 };
  const checkedIds = new Set<number>();
  let fallbackResult: Record<string, unknown> | null = null;

  for (const strategy of strategies) {
    const results = await strategy();
    //console.log(`[DEBUG searchTmdb] strategia #${checkedIds.size}: ${results.length} wyników, top3: ${results.slice(0,3).map(r => r.name ?? r.title).join(", ")}`);
    if (results.length === 0) continue;

    if (!fallbackResult) {
      fallbackResult = results[0];
    }

    if (fwDirectors.length === 0) {
      const extData = await getExternalIds(apiKey, endpoint, results[0].id as number);
      return buildResult(results[0], extData, type, title);
    }

    if (directorCheckBudget.remaining > 0) {
   //   console.log(`[DEBUG searchTmdb] sprawdzam reżysera dla ${Math.min(5, results.length)} kandydatów, budżet pozostały: ${directorCheckBudget.remaining}, szukane: ${fwDirectors.join(", ")}`);
      const confirmed = await findDirectorConfirmed(
        apiKey,
        endpoint,
        results,
        fwDirectors,
        directorCheckBudget,
        checkedIds,
        year,
      );
      if (confirmed) {
       // console.log(`[DEBUG searchTmdb] POTWIERDZONO: ${confirmed.name ?? confirmed.title} (id=${confirmed.id})`);
        const extData = await getExternalIds(apiKey, endpoint, confirmed.id as number);
        return buildResult(confirmed, extData, type, title);
      }
    }
  }
  // console.log(`[DEBUG searchTmdb] KONIEC — fallback: ${fallbackResult?.name ?? fallbackResult?.title ?? "brak"}`);

  if (fallbackResult) {
    const extData = await getExternalIds(apiKey, endpoint, fallbackResult.id as number);
    return buildResult(fallbackResult, extData, type, title);
  }

  if (director) {
    const rawDirectorNames = director.split(/[;,]/).map((d) => d.trim()).filter(Boolean);
    const byDirector = await findByDirectorFilmography(apiKey, endpoint, rawDirectorNames, year);
    if (byDirector) {
      const extData = await getExternalIds(apiKey, endpoint, byDirector.id as number);
      return buildResult(byDirector, extData, type, title);
    }
  }

  return null;
}
