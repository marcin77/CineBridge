import { db } from "@/db";
import { traktMatchCache } from "@/db/schema";
import { like, count } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET — zwróć liczbę wpisów w cache TMDB
export async function GET() {
  const [{ value }] = await db
    .select({ value: count() })
    .from(traktMatchCache)
    .where(like(traktMatchCache.cacheKey, "tmdb:%"));

  return Response.json({ count: value });
}

// DELETE — wyczyść tylko wpisy TMDB (nie dotykaj wpisów Trakt)
export async function DELETE() {
  const [{ value: before }] = await db
    .select({ value: count() })
    .from(traktMatchCache)
    .where(like(traktMatchCache.cacheKey, "tmdb:%"));

  await db
    .delete(traktMatchCache)
    .where(like(traktMatchCache.cacheKey, "tmdb:%"));

  return Response.json({ deleted: before });
}