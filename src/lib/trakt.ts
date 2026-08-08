// Trakt integration – optional feature.
// Requires TRAKT_CLIENT_ID and TRAKT_CLIENT_SECRET environment variables.

export function traktConfigured(): boolean {
  return Boolean(process.env.TRAKT_CLIENT_ID && process.env.TRAKT_CLIENT_SECRET);
}
