import { db } from "@/db";
import { mediaItems } from "@/db/schema";
import { eq, and, isNotNull, notInArray, asc, desc } from "drizzle-orm";

/**
 * Pobiera pozycje z batcha.
 * Jeśli onlyNew=true — filtruje do pozycji których source_id
 * nie istnieje w żadnym innym batchu.
 */
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

  // Zbierz source_id z innych batchów
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

  // Pobierz wszystkie z tego batcha i przefiltruj w JS
  // (SQLite nie ma dobrego NOT IN dla dynamicznych zbiorów > 999)
  const all = await db
    .select()
    .from(mediaItems)
    .where(eq(mediaItems.importBatchId, batchId))
    .orderBy(...order);

  return all.filter(
    (item) => !item.sourceId || !existingIds.has(item.sourceId),
  );
}