import { getSetting } from "@/lib/settings";

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

async function tmdbSearch(
  apiKey: string,
  endpoint: "movie" | "tv",
  query: string,
  year: number | null,
  language?: string,
): Promise<Record<string, unknown> | null> {
  const params = new URLSearchParams({
    api_key: apiKey,
    query,
    ...(language ? { language } : {}),
    ...(year
      ? { [endpoint === "tv" ? "first_air_date_year" : "year"]: String(year) }
      : {}),
  });

  const res = await fetch(`https://api.themoviedb.org/3/search/${endpoint}?${params}`);
  if (!res.ok) return null;

  const data = await res.json();
  return data.results?.[0] ?? null;
}

async function getExternalIds(
  apiKey: string,
  endpoint: "movie" | "tv",
  tmdbId: number,
): Promise<{ imdb_id?: string }> {
  const res = await fetch(
    `https://api.themoviedb.org/3/${endpoint}/${tmdbId}/external_ids?api_key=${apiKey}`,
  );
  return res.ok ? res.json() : {};
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
    year: result.release_date
      ? Number((result.release_date as string).slice(0, 4))
      : result.first_air_date
        ? Number((result.first_air_date as string).slice(0, 4))
        : null,
    type,
  };
}

export async function searchTmdb(
  title: string,
  year: number | null,
  type: "movie" | "show",
  originalTitle?: string | null,
): Promise<TmdbResult | null> {
  const apiKey = await getApiKey();
  if (!apiKey) return null;

  const endpoint = type === "show" ? "tv" : "movie";

  // Deduplikacja tytułów do sprawdzenia
  const titlesToTry = [
    ...new Set(
      [title, originalTitle].filter((t): t is string => !!t && t.trim() !== "")
    ),
  ];

  // ── Strategia fallback (kolejność od najbardziej do najmniej precyzyjnej) ──
  const strategies: Array<() => Promise<Record<string, unknown> | null>> = [
    // 1. Główny tytuł + rok (bez language — zwraca wyniki globalne, sortowane po popularności)
    () => tmdbSearch(apiKey, endpoint, titlesToTry[0], year),

    // 2. Główny tytuł bez roku (rok może być błędny o 1 w Filmweb)
    ...(year ? [() => tmdbSearch(apiKey, endpoint, titlesToTry[0], null)] : []),

    // 3. Oryginalny tytuł + rok (jeśli różni się od głównego)
    ...(titlesToTry[1]
      ? [() => tmdbSearch(apiKey, endpoint, titlesToTry[1], year)]
      : []),

    // 4. Oryginalny tytuł bez roku
    ...(titlesToTry[1] && year
      ? [() => tmdbSearch(apiKey, endpoint, titlesToTry[1], null)]
      : []),

    // 5. Główny tytuł z language=pl-PL + rok (polskie tytuły lokalne)
    () => tmdbSearch(apiKey, endpoint, titlesToTry[0], year, "pl-PL"),

    // 6. Główny tytuł z language=pl-PL bez roku
    ...(year ? [() => tmdbSearch(apiKey, endpoint, titlesToTry[0], null, "pl-PL")] : []),
  ];

  for (const strategy of strategies) {
    const result = await strategy();
    if (result) {
      const extData = await getExternalIds(apiKey, endpoint, result.id as number);
      return buildResult(result, extData, type, title);
    }
  }

  return null;
}