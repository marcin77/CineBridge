import { db } from "@/db";
import { importBatches, mediaItems } from "@/db/schema";
import { parseFilmwebFile } from "@/lib/parsers";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file     = formData.get("file");
    const source   = String(formData.get("source") ?? "filmweb");

    if (!(file instanceof File)) {
      return Response.json({ error: "Brak pliku do zaimportowania." }, { status: 400 });
    }

    const content = await file.text();
    const { items, skipped, detectedFormat } = parseFilmwebFile(file.name, content);

    if (items.length === 0) {
      return Response.json(
        { error: "Nie znaleziono żadnych pozycji w pliku. Sprawdź format pliku." },
        { status: 400 },
      );
    }

    // Determine overall category for the batch (use most common)
    const catCount: Record<string, number> = {};
    for (const item of items) {
      catCount[item.category] = (catCount[item.category] ?? 0) + 1;
    }
    const batchCategory = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "watched";

    const [batch] = await db
      .insert(importBatches)
      .values({
        source,
        filename: file.name,
        category: batchCategory,
        status:   "uploaded",
        totalItems: items.length,
        errorItems: skipped,
      })
      .returning();

    const values = items.map((item) => ({
      importBatchId: batch.id,
      source,
      sourceId:      item.sourceId ?? null,
      category:      item.category,
      type:          item.type,
      title:         item.title,
      originalTitle: item.originalTitle ?? null,
      year:          item.year ?? null,
      userRating:    item.userRating ?? null,
      ratedAt:       item.ratedAt ?? null,
      watchedAt:     item.watchedAt ?? null,
      comment:       item.comment ?? null,
      imdbId:        item.imdbId ?? null,
      tmdbId:        item.tmdbId ?? null,
      listName:      item.listName ?? null,
      matchStatus:   "ready" as const,
    }));

    // Insert in chunks of 500 to avoid pg parameter limit
    const chunkSize = 500;
    for (let i = 0; i < values.length; i += chunkSize) {
      await db.insert(mediaItems).values(values.slice(i, i + chunkSize));
    }

    await db
      .update(importBatches)
      .set({ status: "ready", updatedAt: new Date().toISOString() })
      .where(eq(importBatches.id, batch.id));

    return Response.json({
      batchId: batch.id,
      totalItems: items.length,
      skipped,
      detectedFormat,
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Nie udało się przetworzyć pliku." }, { status: 500 });
  }
}
