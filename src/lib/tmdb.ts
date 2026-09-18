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

  // Usuń znaki specjalne które psują wyszukiwanie TMDB
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

  
  // Deduplikacja tytułów do sprawdzenia
  const titlesToTry = [
    ...new Set(
      [title, originalTitle].filter((t): t is string => !!t && t.trim() !== "")
    ),
  ];

  // Helper — skróć tytuł do części przed dwukropkiem, tylko gdy podtytuł ma min. 2 słowa
  const shortTitle = (t: string): string | null => {
    const colonIdx = t.indexOf(":");
    if (colonIdx === -1) return null;
    const sub = t.slice(colonIdx + 1).trim();
    if (sub.split(/\s+/).length < 2) return null; // "Avengers: Endgame" → nie skróci
    return t.slice(0, colonIdx).trim();
  };

  const short0 = shortTitle(titlesToTry[0]);
  const short1 = titlesToTry[1] ? shortTitle(titlesToTry[1]) : null;

  // ── Strategia fallback (kolejność od najbardziej do najmniej precyzyjnej) ──
    const strategies: Array<() => Promise<Record<string, unknown> | null>> = [
    // 1. Oryginalny tytuł + rok (angielski z Filmweb — najbardziej precyzyjny)
    ...(titlesToTry[1]
      ? [() => tmdbSearch(apiKey, endpoint, titlesToTry[1], year)]
      : []),
    // 2. Oryginalny tytuł bez roku
    ...(titlesToTry[1] && year
      ? [() => tmdbSearch(apiKey, endpoint, titlesToTry[1], null)]
      : []),
    // 3. Główny tytuł + rok (polski — fallback gdy brak original_title)
    () => tmdbSearch(apiKey, endpoint, titlesToTry[0], year),
    // 4. Główny tytuł bez roku
    ...(year ? [() => tmdbSearch(apiKey, endpoint, titlesToTry[0], null)] : []),
    // 5. Skrócony tytuł główny + rok
    ...(short0 ? [() => tmdbSearch(apiKey, endpoint, short0, year)] : []),
    // 6. Skrócony tytuł główny bez roku
    ...(short0 && year ? [() => tmdbSearch(apiKey, endpoint, short0, null)] : []),
    // 7. Skrócony oryginalny + rok
    ...(short1 ? [() => tmdbSearch(apiKey, endpoint, short1, year)] : []),
    // 8. Skrócony oryginalny bez roku
    ...(short1 && year ? [() => tmdbSearch(apiKey, endpoint, short1, null)] : []),
    // 9. Główny tytuł z language=pl-PL + rok
    () => tmdbSearch(apiKey, endpoint, titlesToTry[0], year, "pl-PL"),
    // 10. Główny tytuł z language=pl-PL bez roku
    ...(year ? [() => tmdbSearch(apiKey, endpoint, titlesToTry[0], null, "pl-PL")] : []),
    
 
    // 5. Główny tytuł z language=pl-PL + rok (polskie tytuły lokalne bez angielskiego)
 //   () => tmdbSearch(apiKey, endpoint, titlesToTry[0], year, "pl-PL"),
    // 6. Główny tytuł z language=pl-PL bez roku
 //   ...(year ? [() => tmdbSearch(apiKey, endpoint, titlesToTry[0], null, "pl-PL")] : []),
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