import { db } from "@/db";
import { mediaItems } from "@/db/schema";
import { eq, and, isNotNull, inArray, notInArray, asc, desc } from "drizzle-orm";

export async function getExportItems(batchId: number, onlyNew: boolean) {
  const order = [
    desc(mediaItems.ratedAt),
    desc(mediaItems.watchedAt),
    asc(mediaItems.title),
  ] as const;

  if (!onlyNew) {
    return db
      .select()
      .from(mediaItems)
      .where(eq(mediaItems.importBatchId, batchId))
      .orderBy(...order);
  }

  const existingRows = await db
    .select({ sourceId: mediaItems.sourceId })
    .from(mediaItems)
    .where(
      and(
        notInArray(mediaItems.importBatchId, [batchId]),
        isNotNull(mediaItems.sourceId),
      ),
    );

  const existingIds = new Set(
    existingRows.map((r) => r.sourceId).filter(Boolean) as string[],
  );

  const all = await db
    .select()
    .from(mediaItems)
    .where(eq(mediaItems.importBatchId, batchId))
    .orderBy(...order);

  return all.filter(
    (item) => !item.sourceId || !existingIds.has(item.sourceId),
  );
}

/**
 * Wariant dla Simkl: Simkl operuje wylacznie na poziomie "show", wiec gdy
 * serial ma nowe sezony/odcinki, ale sam wiersz "show" jest stary (jego
 * source_id istnial juz w poprzednich batchach — co jest poprawne, serial
 * jako calosc nie jest "nowy"), standardowy filtr onlyNew usuwa jedyny
 * wiersz, na ktorym Simkl moglby zbudowac eksport (status/rating/LastEpWatched).
 * Dociagamy wiec z powrotem wiersze "show" z tego samego batcha, jesli maja
 * dzieci (season/episode) ktore przeszly filtr onlyNew.
 */
export async function getExportItemsForSimkl(batchId: number, onlyNew: boolean) {
  const items = await getExportItems(batchId, onlyNew);
  if (!onlyNew) return items;

  const newParentIds = new Set(
    items
      .filter((i) => (i.type === "season" || i.type === "episode") && i.parentShowId)
      .map((i) => i.parentShowId as string),
  );
  if (newParentIds.size === 0) return items;

  const alreadyIncluded = new Set(
    items.filter((i) => i.type === "show").map((i) => i.sourceId),
  );
  const missingParentIds = [...newParentIds].filter((id) => !alreadyIncluded.has(id));
  if (missingParentIds.length === 0) return items;

  const parentShows = await db
    .select()
    .from(mediaItems)
    .where(
      and(
        eq(mediaItems.importBatchId, batchId),
        eq(mediaItems.type, "show"),
        inArray(mediaItems.sourceId, missingParentIds),
      ),
    );

  return [...items, ...parentShows];
}