/**
 * Resilientny wrapper na fetch do TMDB — automatyczny retry przy 429
 * (rate limit) i przejściowych błędach sieciowych. Współdzielony przez
 * tmdb.ts i tmdb-episode-match.ts, żeby nie duplikować logiki.
 */
export async function tmdbFetchJson(
  url: string,
  maxRetries = 2,
): Promise<Record<string, unknown> | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url);

      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("Retry-After")) || 1;
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, retryAfter * 1000));
          continue;
        }
        return null;
      }

      if (!res.ok) return null;
      return await res.json();
    } catch {
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      return null;
    }
  }
  return null;
}