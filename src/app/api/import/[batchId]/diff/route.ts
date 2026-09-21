import { db } from "@/db";
import { importBatches, mediaItems } from "@/db/schema";
import { eq, and, isNotNull, notInArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const { batchId } = await params;
  const id = Number(batchId);

  const [batch] = await db
    .select()
    .from(importBatches)
    .where(eq(importBatches.id, id));

  if (!batch) {
    return Response.json({ error: "Nie znaleziono importu." }, { status: 404 });
  }

  // Wszystkie inne batche
  const allBatches = await db
    .select({ id: importBatches.id })
    .from(importBatches);

  const otherBatchIds = allBatches.map((b) => b.id).filter((b) => b !== id);

  // Jedyny batch — brak poprzedniego do porównania
  if (otherBatchIds.length === 0) {
    return Response.json({
      hasPrevious: false,
      newCount: 0,
      total: 0,
      items: [],
    });
  }

  // source_id które istnieją w innych batchach
  const existingRows = await db
    .select({ sourceId: mediaItems.sourceId })
    .from(mediaItems)
    .where(
      and(
        notInArray(mediaItems.importBatchId, [id]),
        isNotNull(mediaItems.sourceId),
      ),
    );

  const existingSourceIds = new Set(
    existingRows
      .map((r) => r.sourceId)
      .filter(Boolean) as string[],
  );

  // Wszystkie pozycje z tego batcha
  const ourItems = await db
    .select()
    .from(mediaItems)
    .where(eq(mediaItems.importBatchId, id));

  // Nowe = source_id nie istnieje w żadnym innym batchu
  // Brak source_id → traktuj jako nowe (bezpieczny fallback)
  const newItems = ourItems.filter(
    (item) => !item.sourceId || !existingSourceIds.has(item.sourceId),
  );

  return Response.json({
    hasPrevious: true,
    newCount: newItems.length,
    total: ourItems.length,
    items: newItems,
  });
}