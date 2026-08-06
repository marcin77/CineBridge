import { db } from "@/db";
import { importBatches, mediaItems, syncLogs } from "@/db/schema";
import { and, asc, count, eq, inArray, or } from "drizzle-orm";
import {
  addItemsToList,
  buildTraktItemPayload,
  ensureCustomList,
  postComment,
  pushHistory,
  pushRatings,
  pushWatchlist,
  refreshTraktTokenIfNeeded,
  traktConfigured,
} from "@/lib/trakt";

export const dynamic = "force-dynamic";

const CHUNK_SIZE = 40;

export async function POST(req: Request, { params }: { params: Promise<{ batchId: string }> }) {
  if (!traktConfigured()) {
    return Response.json({ error: "Trakt nie jest skonfigurowany." }, { status: 400 });
  }

  const { batchId } = await params;
  const id = Number(batchId);
  const body = await req.json().catch(() => ({}));
  const includeComments = Boolean(body?.includeComments);

  const account = await refreshTraktTokenIfNeeded();
  if (!account) {
    return Response.json({ error: "Połącz konto Trakt przed synchronizacją." }, { status: 400 });
  }

  const [batch] = await db.select().from(importBatches).where(eq(importBatches.id, id));
  if (!batch) return Response.json({ error: "Nie znaleziono importu." }, { status: 404 });

  await db.update(importBatches).set({ status: "syncing", updatedAt: new Date() }).where(eq(importBatches.id, id));

  const items = await db
    .select()
    .from(mediaItems)
    .where(
      and(
        eq(mediaItems.importBatchId, id),
        eq(mediaItems.syncedToTrakt, false),
        or(eq(mediaItems.matchStatus, "matched"), eq(mediaItems.matchStatus, "manual")),
      ),
    )
    .orderBy(asc(mediaItems.id))
    .limit(CHUNK_SIZE);

  const succeededIds: number[] = [];
  const failedIds: number[] = [];

  const historyMovies: ReturnType<typeof buildTraktItemPayload>[] = [];
  const historyShows: ReturnType<typeof buildTraktItemPayload>[] = [];
  const ratingMovies: Array<ReturnType<typeof buildTraktItemPayload> & { rating: number; rated_at?: string }> = [];
  const ratingShows: Array<ReturnType<typeof buildTraktItemPayload> & { rating: number; rated_at?: string }> = [];
  const watchlistMovies: ReturnType<typeof buildTraktItemPayload>[] = [];
  const watchlistShows: ReturnType<typeof buildTraktItemPayload>[] = [];
  const favoriteMovies: ReturnType<typeof buildTraktItemPayload>[] = [];
  const favoriteShows: ReturnType<typeof buildTraktItemPayload>[] = [];

  for (const item of items) {
    const payload = buildTraktItemPayload({
      imdbId: item.imdbId,
      tmdbId: item.tmdbId,
      traktId: item.traktId,
      title: item.matchedTitle ?? item.title,
      year: item.matchedYear ?? item.year,
    });
    const isShow = (item.traktType ?? item.type) === "show";
    const watchedAtIso = (item.watchedAt ?? item.ratedAt ?? new Date()).toISOString();

    if (item.category === "watched") {
      const historyPayload = { ...payload, watched_at: watchedAtIso };
      (isShow ? historyShows : historyMovies).push(historyPayload);
      if (item.userRating) {
        const ratingPayload = {
          ...payload,
          rating: item.userRating,
          rated_at: (item.ratedAt ?? item.watchedAt ?? new Date()).toISOString(),
        };
        (isShow ? ratingShows : ratingMovies).push(ratingPayload);
      }
    } else if (item.category === "watchlist") {
      (isShow ? watchlistShows : watchlistMovies).push(payload);
    } else if (item.category === "favorite") {
      (isShow ? favoriteShows : favoriteMovies).push(payload);
    }
  }

  async function logAndCollect(action: string, ok: boolean, message: string) {
    for (const item of items) {
      await db.insert(syncLogs).values({
        importBatchId: id,
        mediaItemId: item.id,
        action,
        status: ok ? "success" : "error",
        message,
      });
    }
  }

  try {
    if (historyMovies.length || historyShows.length) {
      const res = await pushHistory(account.accessToken, historyMovies, historyShows);
      await logAndCollect("history", res.ok, res.ok ? "OK" : await res.text());
      if (!res.ok) throw new Error("history sync failed");
    }
    if (ratingMovies.length || ratingShows.length) {
      const res = await pushRatings(account.accessToken, ratingMovies, ratingShows);
      await logAndCollect("ratings", res.ok, res.ok ? "OK" : await res.text());
      if (!res.ok) throw new Error("ratings sync failed");
    }
    if (watchlistMovies.length || watchlistShows.length) {
      const res = await pushWatchlist(account.accessToken, watchlistMovies, watchlistShows);
      await logAndCollect("watchlist", res.ok, res.ok ? "OK" : await res.text());
      if (!res.ok) throw new Error("watchlist sync failed");
    }
    if (favoriteMovies.length || favoriteShows.length) {
      const listId = await ensureCustomList(account.accessToken, "Ulubione (Filmweb)");
      const res = await addItemsToList(account.accessToken, listId, favoriteMovies, favoriteShows);
      await logAndCollect("list", res.ok, res.ok ? "OK" : await res.text());
      if (!res.ok) throw new Error("list sync failed");
    }

    if (includeComments) {
      for (const item of items) {
        if (!item.comment) continue;
        const type = (item.traktType ?? item.type) === "show" ? "show" : "movie";
        const ids: Record<string, unknown> = {};
        if (item.imdbId) ids.imdb = item.imdbId;
        if (item.tmdbId) ids.tmdb = Number(item.tmdbId);
        if (item.traktId) ids.trakt = item.traktId;
        try {
          const res = await postComment(account.accessToken, type, ids, item.comment);
          await db.insert(syncLogs).values({
            importBatchId: id,
            mediaItemId: item.id,
            action: "comment",
            status: res.ok ? "success" : "error",
            message: res.ok ? "OK" : await res.text(),
          });
        } catch (err) {
          await db.insert(syncLogs).values({
            importBatchId: id,
            mediaItemId: item.id,
            action: "comment",
            status: "error",
            message: String(err),
          });
        }
      }
    }

    succeededIds.push(...items.map((i) => i.id));
  } catch (err) {
    console.error(err);
    failedIds.push(...items.map((i) => i.id));
  }

  if (succeededIds.length) {
    await db
      .update(mediaItems)
      .set({ syncedToTrakt: true, syncedAt: new Date(), syncError: null, updatedAt: new Date() })
      .where(inArray(mediaItems.id, succeededIds));
  }
  if (failedIds.length) {
    await db
      .update(mediaItems)
      .set({ syncError: "Błąd synchronizacji – sprawdź logi.", updatedAt: new Date() })
      .where(inArray(mediaItems.id, failedIds));
  }

  const [remaining] = await db
    .select({ value: count() })
    .from(mediaItems)
    .where(
      and(
        eq(mediaItems.importBatchId, id),
        eq(mediaItems.syncedToTrakt, false),
        or(eq(mediaItems.matchStatus, "matched"), eq(mediaItems.matchStatus, "manual")),
      ),
    );

  const [syncedCount] = await db
    .select({ value: count() })
    .from(mediaItems)
    .where(and(eq(mediaItems.importBatchId, id), eq(mediaItems.syncedToTrakt, true)));

  await db
    .update(importBatches)
    .set({
      status: remaining.value === 0 ? "completed" : "syncing",
      syncedItems: syncedCount.value,
      updatedAt: new Date(),
    })
    .where(eq(importBatches.id, id));

  return Response.json({
    processed: items.length,
    succeeded: succeededIds.length,
    failed: failedIds.length,
    remaining: remaining.value,
  });
}
