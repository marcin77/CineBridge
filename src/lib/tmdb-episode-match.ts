const TMDB_BASE = "https://api.themoviedb.org/3";
import { tmdbFetchJson } from "@/lib/tmdb-fetch";
import { singularize, parseDirectors, directorsOverlap, getTmdbDirectors, resultYear } from "@/lib/tmdb";

export function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export interface KnownEpisode {
  episodeNumber: number;
  episodeTitle: string | null;
}

export interface TmdbEpisodeStub {
  episode_number: number;
  name: string;
}

/**
 * Sprawdza czy WIĘKSZOŚĆ znanych (niepustych) tytułów odcinków z Filmweba
 * zgadza się z odpowiadającymi im odcinkami z TMDB. Wymaga progu 60%
 * zamiast 100% — pojedyncze różnice w tłumaczeniu (inny tłumacz,
 * interpunkcja) nie powinny odrzucać poprawnego dopasowania. Jednocześnie
 * ewidentnie błędne dopasowania (np. zupełnie inny serial) mają zwykle
 * 0% zgodności, więc nadal zostaną odrzucone.
 */
/**
 * Sprawdza czy dopasowanie jest EWIDENTNIE błędne (zupełnie inny serial).
 * Używane do decyzji "czy odrzucić już znalezione bezpośrednie dopasowanie
 * sezonu". Celowo NISKI próg — różnice w tłumaczeniach między Filmwebem
 * a TMDB są częste i normalne (ta sama treść, inny tłumacz), więc
 * odrzucamy tylko gdy niemal ŻADEN tytuł się nie zgadza (silny sygnał,
 * że to zupełnie inny byt, jak "Krakowskie potwory" zamiast "Potwory").
 */
export function isObviousMismatch(
  tmdbEpisodes: TmdbEpisodeStub[],
  known: KnownEpisode[],
  minMatchRatio = 0.25,
): boolean {
  const withTitles = known.filter(
    (e): e is KnownEpisode & { episodeTitle: string } =>
      !!e.episodeTitle && e.episodeTitle.trim().length > 0,
  );
  if (withTitles.length === 0) return false; // brak danych — nie oceniamy

  let matchCount = 0;
  for (const k of withTitles) {
    const ep = tmdbEpisodes.find((e) => e.episode_number === k.episodeNumber);
    if (ep && normalizeTitle(ep.name) === normalizeTitle(k.episodeTitle)) {
      matchCount++;
    }
  }

  if (withTitles.length === 1) {
    // Przy jednym znanym tytule nie ma marginesu na "różnice w tłumaczeniu"
    // — jeśli się nie zgadza, to albo zły sezon, albo (rzadziej) inne
    // tłumaczenie. Akceptujemy ryzyko i wymagamy zgodności.
    return matchCount === 0;
  }

  return matchCount / withTitles.length < minMatchRatio;
}

/**
 * Sprawdza czy dopasowanie jest WYSOCE pewne — wymaga większości zgodnych
 * tytułów. Używane przy wybieraniu NOWEGO kandydata spośród wielu wyników
 * wyszukiwania (fallback antologii) — tu chcemy wysokiej precyzji, żeby
 * nie złapać przypadkiem niewłaściwego serialu.
 */
export function isConfidentMatch(
  tmdbEpisodes: TmdbEpisodeStub[],
  known: KnownEpisode[],
  minMatchRatio = 0.7,
): boolean {
  const withTitles = known.filter(
    (e): e is KnownEpisode & { episodeTitle: string } =>
      !!e.episodeTitle && e.episodeTitle.trim().length > 0,
  );
  if (withTitles.length === 0) return false;

  let matchCount = 0;
  for (const k of withTitles) {
    const ep = tmdbEpisodes.find((e) => e.episode_number === k.episodeNumber);
    if (ep && normalizeTitle(ep.name) === normalizeTitle(k.episodeTitle)) {
      matchCount++;
    }
  }

  if (withTitles.length <= 2) {
    return matchCount === withTitles.length; // mała próba — wymagaj pełnej zgodności
  }

  return matchCount / withTitles.length >= minMatchRatio;
}
export async function fetchSeasonEpisodesPl(
  apiKey: string,
  showId: string,
  seasonNumber: number,
): Promise<TmdbEpisodeStub[] | null> {
  const data = await tmdbFetchJson(
    `${TMDB_BASE}/tv/${showId}/season/${seasonNumber}?language=pl-PL&api_key=${apiKey}`,
  );
  return (data?.episodes as TmdbEpisodeStub[]) ?? null;
}

/** Zwraca ID obiektu sezonu ORAZ jego rok (z air_date) — jednym zapytaniem,
 *  żeby nie dublować requestu tylko po to, by osobno sprawdzić rok. */
export async function fetchSeasonMeta(
  apiKey: string,
  showId: string,
  seasonNumber: number,
): Promise<{ id: string; year: number | null } | null> {
  const data = await tmdbFetchJson(
    `${TMDB_BASE}/tv/${showId}/season/${seasonNumber}?language=en-US&api_key=${apiKey}`,
  );
  if (!data?.id) return null;
  const airDate = data.air_date as string | undefined;
  const year = airDate ? Number(airDate.slice(0, 4)) : null;
  return { id: String(data.id), year: Number.isNaN(year as number) ? null : year };
}
export async function searchTvCandidates(
  apiKey: string,
  query: string,
): Promise<Array<{ id: number }>> {
  if (!query.trim()) return [];
  const data = await tmdbFetchJson(
    `${TMDB_BASE}/search/tv?query=${encodeURIComponent(query)}&language=pl-PL&api_key=${apiKey}`,
  );
  return (data?.results as Array<{ id: number }>) ?? [];
}

export async function fetchShowExternalIds(
  apiKey: string,
  showId: string,
): Promise<{ imdbId: string | null }> {
  const data = await tmdbFetchJson(`${TMDB_BASE}/tv/${showId}/external_ids?api_key=${apiKey}`);
  return { imdbId: (data?.imdb_id as string) || null };
}

/**
 * Wariant findShowMatchByEpisodeTitles dla przypadków, gdzie NIE MA
 * ocenionych/znanych tytułów odcinków (np. sezony antologii ocenione
 * tylko zbiorczo, bez ocen odcinków — "Potwory" sezon 2/3 na Filmwebie).
 * Bez tytułów odcinków jedyny dostępny sygnał weryfikujący to reżyser
 * PRZYPISANY DO TEGO KONKRETNEGO SEZONU (nie całego serialu) + rok sezonu
 * — oba dostępne dzięki scrapowaniu strony cast/crew per sezon.
 *
 * Jeśli known.length > 0 (są tytuły odcinków), zachowuje się identycznie
 * jak findShowMatchByEpisodeTitles — tytuły odcinków są mocniejszym
 * dowodem niż reżyser+rok, więc mają pierwszeństwo. Reżyser+rok jest
 * używany TYLKO gdy nie ma czego innego sprawdzić.
 */
export async function findShowMatchBySeasonMetadata(
  apiKey: string,
  titleQueries: string[],
  seasonNumberToCheck: number,
  known: KnownEpisode[],
  seasonDirectorsRaw: string | null,
  seasonYear: number | null,
  hasSpecificSeasonTitle: boolean, // NOWE: true gdy titleQueries zawiera podtytuł
                                     // antologii (np. "Historia Eda Geina"), a nie
                                     // tylko ogólny tytuł show'a
): Promise<{ showTmdbId: string | null }> {
  const expandedQueries = [...titleQueries];
  for (const q of titleQueries) {
    const sing = singularize(q);
    if (sing) expandedQueries.push(sing);
  }

  const seen = new Set<number>();
  const candidates: number[] = [];
  for (const q of expandedQueries) {
    const results = await searchTvCandidates(apiKey, q);
    for (const r of results) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        candidates.push(r.id);
      }
    }
  }
  console.log(`[DEBUG season-meta] queries=${expandedQueries.join("|")} season=${seasonNumberToCheck} kandydatów=${candidates.length} directors=${seasonDirectorsRaw} year=${seasonYear} specTitle=${hasSpecificSeasonTitle}`);

  const fwDirectors = parseDirectors(seasonDirectorsRaw);
  const hasKnownTitles = known.some((e) => e.episodeTitle && e.episodeTitle.trim().length > 0);

  for (const candidateId of candidates.slice(0, 30)) {
    if (hasKnownTitles) {
      const episodes = await fetchSeasonEpisodesPl(apiKey, String(candidateId), seasonNumberToCheck);
      if (episodes && isConfidentMatch(episodes, known)) {
        console.log(`[DEBUG season-meta] id=${candidateId} potwierdzono przez tytuły odcinków`);
        return { showTmdbId: String(candidateId) };
      }
      continue;
    }

    const showDetails = await tmdbFetchJson(`${TMDB_BASE}/tv/${candidateId}?api_key=${apiKey}`);
    if (!showDetails) continue;
    const candYear = resultYear(showDetails);

    if (hasSpecificSeasonTitle) {
      // Podtytuł sezonu (np. "Historia Eda Geina") + wyszukiwanie TMDB po
      // nim samym to już bardzo mocny sygnał. Rok sprawdzamy TYLKO gdy
      // dostępny po obu stronach — reżyser NIE jest wymagany, bo Filmweb
      // czasem jeszcze nie ma uzupełnionej obsady dla świeżych sezonów
      // antologii i wtedy fallbackuje do reżyserów CAŁEGO serialu, co
      // fałszywie odrzucało poprawne dopasowania (przypadek Ed Gein).
      if (seasonYear !== null && candYear !== null && candYear !== seasonYear) {
        continue;
      }
      console.log(`[DEBUG season-meta] id=${candidateId} potwierdzono przez tytuł sezonu+rok (cand=${candYear})`);
      return { showTmdbId: String(candidateId) };
    }

    // Brak specyficznego podtytułu — zwykły, numerowany sezon. Tu rok MUSI
    // się zgadzać DOKŁADNIE (tolerancja 0) — to jedyny sposób odróżnienia
    // kolejnych, następujących rok-po-roku instalacji antologii (np.
    // Menendez 2024 vs Gein 2025) korzystających z tej samej puli reżyserów.
    if (seasonYear !== null && candYear !== null && candYear !== seasonYear) {
      continue;
    }
    if (fwDirectors.length === 0) continue;

    const tmdbDirectors = await getTmdbDirectors(apiKey, "tv", candidateId);
    if (directorsOverlap(fwDirectors, tmdbDirectors)) {
      console.log(`[DEBUG season-meta] id=${candidateId} potwierdzono przez reżyser+rok (cand=${candYear})`);
      return { showTmdbId: String(candidateId) };
    }
  }

  return { showTmdbId: null };
}

/**
 * Szuka serialu w TMDB, którego dany numer sezonu ma tytuły odcinków
 * DOKŁADNIE zgodne ze znanymi tytułami z Filmweba. Używane zarówno do
 * naprawy błędnego dopasowania show-poziomu, jak i do dopasowywania
 * "sezonów-antologii" (Filmweb-sezon = osobny serial w TMDB).
 */
export async function findShowMatchByEpisodeTitles(
  apiKey: string,
  titleQueries: string[],
  seasonNumberToCheck: number,
  known: KnownEpisode[],
): Promise<{ showTmdbId: string | null }> {
  const expandedQueries = [...titleQueries];
  for (const q of titleQueries) {
    const sing = singularize(q);
    if (sing) expandedQueries.push(sing);
  }

  const seen = new Set<number>();
  const candidates: number[] = [];
  for (const q of expandedQueries) {
    const results = await searchTvCandidates(apiKey, q);
    for (const r of results) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        candidates.push(r.id);
      }
    }
  }
   console.log(`[DEBUG antology] queries=${expandedQueries.join("|")} season=${seasonNumberToCheck} kandydatów=${candidates.length}`);

  for (const candidateId of candidates.slice(0, 30)) {
    const episodes = await fetchSeasonEpisodesPl(apiKey, String(candidateId), seasonNumberToCheck);
    if (!episodes) { console.log(`[DEBUG antology] id=${candidateId} brak danych sezonu`); continue; }
    const match = isConfidentMatch(episodes, known);
    console.log(`[DEBUG antology] id=${candidateId} epizodów_tmdb=${episodes.length} confident=${match}`);
    if (match) return { showTmdbId: String(candidateId) };
  }
  return { showTmdbId: null };
}