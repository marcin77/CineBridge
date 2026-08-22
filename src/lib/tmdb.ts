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
  return (
    process.env.TMDB_API_KEY ?? (await getSetting("tmdb_api_key"))
  );
}

export async function searchTmdb(
  title: string,
  year: number | null,
  type: "movie" | "show",
): Promise<TmdbResult | null> {
  const apiKey = await getApiKey();
  if (!apiKey) return null;

  const endpoint = type === "show" ? "tv" : "movie";
  const params = new URLSearchParams({
    api_key: apiKey,
    query: title,
    language: "en-US",
    ...(year ? { [type === "show" ? "first_air_date_year" : "year"]: String(year) } : {}),
  });

  const res = await fetch(`https://api.themoviedb.org/3/search/${endpoint}?${params}`);
  if (!res.ok) return null;

  const data = await res.json();
  const result = data.results?.[0];
  if (!result) return null;

  // Pobierz external IDs (żeby dostać imdb_id)
  const extRes = await fetch(
    `https://api.themoviedb.org/3/${endpoint}/${result.id}/external_ids?api_key=${apiKey}`,
  );
  const extData = extRes.ok ? await extRes.json() : {};

  return {
    tmdbId: String(result.id),
    imdbId: extData.imdb_id ?? null,
    title: (type === "show" ? result.name : result.title) ?? title,
    originalTitle: (type === "show" ? result.original_name : result.original_title) ?? title,
    year: result.release_date
      ? Number(result.release_date.slice(0, 4))
      : result.first_air_date
        ? Number(result.first_air_date.slice(0, 4))
        : null,
    type,
  };
}