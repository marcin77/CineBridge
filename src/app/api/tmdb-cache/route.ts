import { db } from "@/db";
import { mediaItems, traktMatchCache } from "@/db/schema";
import { like, count, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET — zwróć liczbę wpisów w cache TMDB
export async function GET() {
  const [{ value }] = await db
    .select({ value: count() })
    .from(traktMatchCache)
    .where(like(traktMatchCache.cacheKey, "tmdb:%"));

  return Response.json({ count: value });
}

// DELETE — wyczyść cache TMDB i zresetuj dopasowania w media_items
export async function DELETE() {
  const [{ value: before }] = await db
    .select({ value: count() })
    .from(traktMatchCache)
    .where(like(traktMatchCache.cacheKey, "tmdb:%"));

  // 1. Wyczyść cache
  await db
    .delete(traktMatchCache)
    .where(like(traktMatchCache.cacheKey, "tmdb:%"));

  // 2. Zresetuj wszystkie dopasowania w media_items
  await db
    .update(mediaItems)
    .set({
      tmdbId:       null,
      imdbId:       null,
      matchedTitle: null,
      matchedYear:  null,
      tmdbSearched: false,
      updatedAt:    new Date().toISOString(),
    });

  return Response.json({ deleted: before });
}