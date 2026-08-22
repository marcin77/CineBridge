import { db } from "@/db";
import { importBatches, mediaItems } from "@/db/schema";
import { and, asc, count, eq, isNull, or } from "drizzle-orm";
import { searchTmdb } from "@/lib/tmdb";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

const CHUNK = 20;

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

  // Pobierz TYLKO pozycje bez OBU ID jednocześnie
  // (jeśli ma choćby jedno z nich - pomijamy, Simkl sobie poradzi)
  const items = await db
    .select()
    .from(mediaItems)
    .where(
      and(
        eq(mediaItems.importBatchId, id),
        isNull(mediaItems.imdbId),
        isNull(mediaItems.tmdbId),
        eq(mediaItems.tmdbSearched, false), // NOWE

      ),
    )
    .orderBy(asc(mediaItems.id))
    .limit(CHUNK);

  let matched = 0;
  let failed  = 0;

  for (const item of items) {
    const searchTitle = item.originalTitle ?? item.title;
    const result = await searchTmdb(
      searchTitle,
      item.year,
      item.type as "movie" | "show",
    );

    if (result) {
      await db
        .update(mediaItems)
        .set({
          tmdbId:       result.tmdbId,
          imdbId:       result.imdbId ?? null,
          matchedTitle: result.originalTitle,
          matchedYear:  result.year ?? item.year,
          tmdbSearched:  true, // NOWE
          updatedAt:    new Date().toISOString(),
        })
        .where(eq(mediaItems.id, item.id));
      matched++;
    } else {
      await db
          .update(mediaItems)
          .set({
            tmdbSearched: true, // NOWE — oznacz jako sprawdzone, nie znajdowane ponownie
            updatedAt:    new Date().toISOString(),
          })
          .where(eq(mediaItems.id, item.id));
        failed++;
      }
  }

  // Remaining — tylko te których jeszcze nie sprawdzano
  const [{ value: remaining }] = await db
    .select({ value: count() })
    .from(mediaItems)
    .where(
      and(
        eq(mediaItems.importBatchId, id),
        isNull(mediaItems.imdbId),
        isNull(mediaItems.tmdbId),
        eq(mediaItems.tmdbSearched, false), // NOWE
      ),
    );

  return Response.json({ matched, failed, remaining });
}