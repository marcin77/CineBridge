import { db } from "@/db";
import { importBatches, mediaItems, traktMatchCache } from "@/db/schema";
import { and, asc, count, eq } from "drizzle-orm";
import { findBestMatch } from "@/lib/matching";
import { traktConfigured } from "@/lib/trakt";

export const dynamic = "force-dynamic";

const CHUNK_SIZE = 25;

export async function POST(_req: Request, { params }: { params: Promise<{ batchId: string }> }) {
  if (!traktConfigured()) {
    return Response.json(
      { error: "Skonfiguruj TRAKT_CLIENT_ID i TRAKT_CLIENT_SECRET, aby włączyć dopasowywanie." },
      { status: 400 },
    );
  }

  const { batchId } = await params;
  const id = Number(batchId);
  const [batch] = await db.select().from(importBatches).where(eq(importBatches.id, id));
  if (!batch) return Response.json({ error: "Nie znaleziono importu." }, { status: 404 });

  await db
    .update(importBatches)
    .set({ status: "matching", updatedAt: new Date() })
    .where(eq(importBatches.id, id));

  const pendingItems = await db
    .select()
    .from(mediaItems)
    .where(and(eq(mediaItems.importBatchId, id), eq(mediaItems.matchStatus, "pending")))
    .orderBy(asc(mediaItems.id))
    .limit(CHUNK_SIZE);

  for (const item of pendingItems) {
    const cacheKey = `${item.type}:${item.title.toLowerCase()}:${item.year ?? ""}`;
    let outcome;

    const [cached] = await db
      .select()
      .from(traktMatchCache)
      .where(eq(traktMatchCache.cacheKey, cacheKey))
      .limit(1);

    if (cached) {
      outcome = {
        status: cached.confidence >= 80 ? "matched" : cached.confidence >= 40 ? "manual" : "unmatched",
        confidence: cached.confidence,
        result: cached.traktId
          ? {
              type: cached.type as "movie" | "show",
              title: cached.matchedTitle ?? item.title,
              year: cached.matchedYear,
              imdbId: cached.imdbId,
              tmdbId: cached.tmdbId,
              traktId: cached.traktId,
              score: cached.score ?? 0,
            }
          : null,
      } as const;
    } else {
      try {
        outcome = await findBestMatch(item.title, item.year, item.originalTitle);
      } catch (err) {
        console.error("Match error", err);
        outcome = { status: "unmatched" as const, confidence: 0, result: null };
      }
      await db
        .insert(traktMatchCache)
        .values({
          cacheKey,
          type: outcome.result?.type ?? item.type,
          imdbId: outcome.result?.imdbId ?? null,
          tmdbId: outcome.result?.tmdbId ?? null,
          traktId: outcome.result?.traktId ?? null,
          matchedTitle: outcome.result?.title ?? null,
          matchedYear: outcome.result?.year ?? null,
          confidence: outcome.confidence,
          score: outcome.result?.score ?? null,
        })
        .onConflictDoNothing();
    }

    await db
      .update(mediaItems)
      .set({
        matchStatus: outcome.status,
        matchConfidence: outcome.confidence,
        imdbId: outcome.result?.imdbId ?? null,
        tmdbId: outcome.result?.tmdbId ?? null,
        traktId: outcome.result?.traktId ?? null,
        traktType: outcome.result?.type ?? null,
        matchedTitle: outcome.result?.title ?? null,
        matchedYear: outcome.result?.year ?? null,
        updatedAt: new Date(),
      })
      .where(eq(mediaItems.id, item.id));
  }

  const [remainingCount] = await db
    .select({ value: count() })
    .from(mediaItems)
    .where(and(eq(mediaItems.importBatchId, id), eq(mediaItems.matchStatus, "pending")));

  const statusCounts = await db
    .select({ status: mediaItems.matchStatus, value: count() })
    .from(mediaItems)
    .where(eq(mediaItems.importBatchId, id));

  const matched = statusCounts.find((s) => s.status === "matched")?.value ?? 0;
  const unmatched = statusCounts.find((s) => s.status === "unmatched")?.value ?? 0;

  const remaining = remainingCount.value;
  await db
    .update(importBatches)
    .set({
      status: remaining === 0 ? "ready" : "matching",
      matchedItems: matched,
      unmatchedItems: unmatched,
      updatedAt: new Date(),
    })
    .where(eq(importBatches.id, id));

  return Response.json({ processed: pendingItems.length, remaining, statusCounts });
}
