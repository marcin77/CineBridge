import { db } from "@/db";
import { importBatches, mediaItems, traktMatchCache } from "@/db/schema";
import { and, asc, count, eq, isNull, inArray } from "drizzle-orm";
import { searchTmdb } from "@/lib/tmdb";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

const CHUNK = 20;

function tmdbCacheKey(type: string, title: string, year: number | null): string {
  return `tmdb:${type}:${title.toLowerCase()}:${year ?? ""}`;
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const apiKey = await getSetting("tmdb_api_key");
  if (!apiKey) {
    return Response.json(
      { error: "Brak klucza TMDB API. Dodaj go w Ustawieniach." },
      { status: 400 },
    );
  }

  const { batchId } = await params;
  const id = Number(batchId);

  const [batch] = await db
    .select()
    .from(importBatches)
    .where(eq(importBatches.id, id));
  if (!batch) return Response.json({ error: "Nie znaleziono importu." }, { status: 404 });

  const items = await db
    .select()
    .from(mediaItems)
    .where(
      and(
        eq(mediaItems.importBatchId, id),
        isNull(mediaItems.imdbId),
        isNull(mediaItems.tmdbId),
        eq(mediaItems.tmdbSearched, false),
        inArray(mediaItems.type, ["movie", "show"]),
      ),
    )
    .orderBy(asc(mediaItems.id))
    .limit(CHUNK);

  let matched = 0;
  let failed  = 0;
  let fromCache = 0;

  for (const item of items) {
    // ↓ ZMIANA: klucz oparty na item.title (stabilny), nie na searchTitle
    const cacheKey = tmdbCacheKey(item.type, item.title, item.year);

    // ── Sprawdź cache przed odpytaniem TMDB API ──
    const [cached] = await db
      .select()
      .from(traktMatchCache)
      .where(eq(traktMatchCache.cacheKey, cacheKey))
      .limit(1);

    let result: Awaited<ReturnType<typeof searchTmdb>> = null;

    if (cached) {
      fromCache++;
      if (cached.tmdbId) {
        result = {
          tmdbId: cached.tmdbId,
          imdbId: cached.imdbId,
          title: cached.matchedTitle ?? item.title,
          originalTitle: cached.matchedTitle ?? item.title,
          year: cached.matchedYear,
          type: item.type as "movie" | "show",
        };
      }
      // cached.tmdbId === null → wcześniej nie znaleziono, result zostaje null
    } else {
      // ↓ ZMIANA: przekazujemy oba tytuły — searchTmdb sam próbuje wszystkich strategii
      result = await searchTmdb(
        item.title,
        item.year,
        item.type as "movie" | "show",
        item.originalTitle,
      );
      // ↑ ZMIANA

      // Zapisz wynik (pozytywny lub negatywny) do cache — kolejne batche skorzystają
      await db
        .insert(traktMatchCache)
        .values({
          cacheKey,
          type: item.type,
          imdbId: result?.imdbId ?? null,
          tmdbId: result?.tmdbId ?? null,
          traktId: null,
          matchedTitle: result?.title ?? null,
          matchedYear: result?.year ?? null,
          confidence: result ? 100 : 0,
          score: null,
        })
        .onConflictDoNothing();
    }

    if (result) {
      await db
        .update(mediaItems)
        .set({
          tmdbId:       result.tmdbId,
          imdbId:       result.imdbId ?? null,
          matchedTitle: result.title,
          matchedYear:  result.year ?? item.year,
          tmdbSearched: true,
          updatedAt:    new Date().toISOString(),
        })
        .where(eq(mediaItems.id, item.id));
      matched++;
    } else {
      await db
        .update(mediaItems)
        .set({
          tmdbSearched: true,
          updatedAt:    new Date().toISOString(),
        })
        .where(eq(mediaItems.id, item.id));
      failed++;
    }
  }

  const [{ value: remaining }] = await db
    .select({ value: count() })
    .from(mediaItems)
    .where(
      and(
        eq(mediaItems.importBatchId, id),
        isNull(mediaItems.imdbId),
        isNull(mediaItems.tmdbId),
        eq(mediaItems.tmdbSearched, false),
        inArray(mediaItems.type, ["movie", "show"]),
      ),
    );

  return Response.json({ matched, failed, remaining, fromCache });
}