import { db } from "@/db";
import { traktAccounts } from "@/db/schema";
import { desc } from "drizzle-orm";

const TRAKT_API_BASE = "https://api.trakt.tv";

export function traktConfigured() {
  return Boolean(process.env.TRAKT_CLIENT_ID && process.env.TRAKT_CLIENT_SECRET);
}

export function getTraktClientId() {
  const id = process.env.TRAKT_CLIENT_ID;
  if (!id) throw new Error("TRAKT_CLIENT_ID nie jest skonfigurowany");
  return id;
}

function getTraktClientSecret() {
  const secret = process.env.TRAKT_CLIENT_SECRET;
  if (!secret) throw new Error("TRAKT_CLIENT_SECRET nie jest skonfigurowany");
  return secret;
}

function baseHeaders(extra?: Record<string, string>) {
  return {
    "Content-Type": "application/json",
    "trakt-api-version": "2",
    "trakt-api-key": getTraktClientId(),
    ...extra,
  };
}

export async function traktFetch(
  path: string,
  init: RequestInit & { accessToken?: string } = {},
) {
  const { accessToken, headers, ...rest } = init;
  const res = await fetch(`${TRAKT_API_BASE}${path}`, {
    ...rest,
    headers: baseHeaders({
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(headers as Record<string, string> | undefined),
    }),
    cache: "no-store",
  });
  return res;
}

// ---------------------------------------------------------------------------
// Device code OAuth flow (works great for self-hosted / desktop-style apps —
// no redirect URI juggling needed).
// ---------------------------------------------------------------------------
export async function startDeviceCode() {
  const res = await fetch(`${TRAKT_API_BASE}/oauth/device/code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: getTraktClientId() }),
  });
  if (!res.ok) {
    throw new Error(`Nie udało się rozpocząć autoryzacji Trakt (${res.status})`);
  }
  return (await res.json()) as {
    device_code: string;
    user_code: string;
    verification_url: string;
    expires_in: number;
    interval: number;
  };
}

export async function pollDeviceToken(deviceCode: string) {
  const res = await fetch(`${TRAKT_API_BASE}/oauth/device/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: deviceCode,
      client_id: getTraktClientId(),
      client_secret: getTraktClientSecret(),
    }),
  });

  if (res.status === 200) {
    const data = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      scope: string;
    };
    return { status: "success" as const, data };
  }
  if (res.status === 400) return { status: "pending" as const };
  if (res.status === 404) return { status: "expired" as const };
  if (res.status === 409) return { status: "already_used" as const };
  if (res.status === 410) return { status: "expired" as const };
  if (res.status === 418) return { status: "denied" as const };
  if (res.status === 429) return { status: "slow_down" as const };
  return { status: "error" as const };
}

export async function getActiveTraktAccount() {
  const [account] = await db
    .select()
    .from(traktAccounts)
    .orderBy(desc(traktAccounts.connectedAt))
    .limit(1);
  return account ?? null;
}

export async function saveTraktTokens(tokens: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
}) {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  let username: string | null = null;
  try {
    const profileRes = await traktFetch("/users/me", { accessToken: tokens.access_token });
    if (profileRes.ok) {
      const profile = await profileRes.json();
      username = profile?.username ?? profile?.ids?.slug ?? null;
    }
  } catch {
    // profile lookup is best-effort only
  }

  await db.insert(traktAccounts).values({
    traktUsername: username,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    scope: tokens.scope,
    expiresAt,
  });
}

export async function refreshTraktTokenIfNeeded() {
  const account = await getActiveTraktAccount();
  if (!account) return null;

  const expiresInMs = account.expiresAt.getTime() - Date.now();
  if (expiresInMs > 5 * 60 * 1000) return account; // still valid for 5+ minutes

  const res = await fetch(`${TRAKT_API_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      refresh_token: account.refreshToken,
      client_id: getTraktClientId(),
      client_secret: getTraktClientSecret(),
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) return account; // fall back to existing token, request may still fail
  const tokens = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
  };
  await saveTraktTokens(tokens);
  return getActiveTraktAccount();
}

// ---------------------------------------------------------------------------
// Search helper – used both for automated matching and manual re-matching.
// ---------------------------------------------------------------------------
export interface TraktSearchResult {
  type: "movie" | "show";
  title: string;
  year: number | null;
  imdbId: string | null;
  tmdbId: string | null;
  traktId: number;
  score: number;
}

export async function searchTrakt(query: string, year?: number | null) {
  const params = new URLSearchParams({ query, limit: "8" });
  if (year) params.set("years", String(year));
  const res = await traktFetch(`/search/movie,show?${params.toString()}`);
  if (!res.ok) return [] as TraktSearchResult[];
  const data = (await res.json()) as Array<{
    type: "movie" | "show";
    score: number;
    movie?: { title: string; year: number; ids: { imdb: string; tmdb: number; trakt: number } };
    show?: { title: string; year: number; ids: { imdb: string; tmdb: number; trakt: number } };
  }>;
  const results: TraktSearchResult[] = [];
  for (const entry of data) {
    const item = entry.movie ?? entry.show;
    if (!item) continue;
    results.push({
      type: entry.type,
      title: item.title,
      year: item.year ?? null,
      imdbId: item.ids.imdb ?? null,
      tmdbId: item.ids.tmdb ? String(item.ids.tmdb) : null,
      traktId: item.ids.trakt,
      score: entry.score,
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Sync helpers
// ---------------------------------------------------------------------------
function idsPayload(item: { imdbId: string | null; tmdbId: string | null; traktId: number | null }) {
  const ids: Record<string, string | number> = {};
  if (item.imdbId) ids.imdb = item.imdbId;
  if (item.tmdbId) ids.tmdb = Number(item.tmdbId);
  if (item.traktId) ids.trakt = item.traktId;
  return ids;
}

export function buildTraktItemPayload(item: {
  imdbId: string | null;
  tmdbId: string | null;
  traktId: number | null;
  title: string;
  year: number | null;
}) {
  return {
    ids: idsPayload(item),
    title: item.title,
    year: item.year ?? undefined,
  };
}

export async function pushHistory(
  accessToken: string,
  movies: Array<{ ids: Record<string, unknown>; title: string; year?: number; watched_at?: string }>,
  shows: Array<{ ids: Record<string, unknown>; title: string; year?: number; watched_at?: string }>,
) {
  return traktFetch("/sync/history", {
    method: "POST",
    accessToken,
    body: JSON.stringify({ movies, shows }),
  });
}

export async function pushRatings(
  accessToken: string,
  movies: Array<{ ids: Record<string, unknown>; title: string; year?: number; rating: number; rated_at?: string }>,
  shows: Array<{ ids: Record<string, unknown>; title: string; year?: number; rating: number; rated_at?: string }>,
) {
  return traktFetch("/sync/ratings", {
    method: "POST",
    accessToken,
    body: JSON.stringify({ movies, shows }),
  });
}

export async function pushWatchlist(
  accessToken: string,
  movies: Array<{ ids: Record<string, unknown>; title: string; year?: number }>,
  shows: Array<{ ids: Record<string, unknown>; title: string; year?: number }>,
) {
  return traktFetch("/sync/watchlist", {
    method: "POST",
    accessToken,
    body: JSON.stringify({ movies, shows }),
  });
}

export async function ensureCustomList(accessToken: string, name: string) {
  const listRes = await traktFetch("/users/me/lists", { accessToken });
  if (listRes.ok) {
    const lists = (await listRes.json()) as Array<{ name: string; ids: { trakt: number } }>;
    const existing = lists.find((l) => l.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing.ids.trakt;
  }
  const createRes = await traktFetch("/users/me/lists", {
    method: "POST",
    accessToken,
    body: JSON.stringify({ name, privacy: "private", display_numbers: true }),
  });
  if (!createRes.ok) throw new Error("Nie udało się utworzyć listy na Trakt");
  const created = (await createRes.json()) as { ids: { trakt: number } };
  return created.ids.trakt;
}

export async function addItemsToList(
  accessToken: string,
  listId: number,
  movies: Array<{ ids: Record<string, unknown> }>,
  shows: Array<{ ids: Record<string, unknown> }>,
) {
  return traktFetch(`/users/me/lists/${listId}/items`, {
    method: "POST",
    accessToken,
    body: JSON.stringify({ movies, shows }),
  });
}

export async function postComment(
  accessToken: string,
  type: "movie" | "show",
  ids: Record<string, unknown>,
  comment: string,
) {
  return traktFetch("/comments", {
    method: "POST",
    accessToken,
    body: JSON.stringify({ comment, spoiler: false, [type]: { ids } }),
  });
}
