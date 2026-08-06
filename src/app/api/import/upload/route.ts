import { db } from "@/db";
import { importBatches, mediaItems } from "@/db/schema";
import { parseFilmwebFile } from "@/lib/parsers";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const category = String(formData.get("category") ?? "watched");
    const source = String(formData.get("source") ?? "filmweb");

    if (!(file instanceof File)) {
      return Response.json({ error: "Brak pliku do zaimportowania." }, { status: 400 });
    }
    if (!["watched", "watchlist", "favorite"].includes(category)) {
      return Response.json({ error: "Nieprawidłowa kategoria." }, { status: 400 });
    }

    const content = await file.text();
    const { items, skipped, detectedFormat } = parseFilmwebFile(file.name, content);

    if (items.length === 0) {
      return Response.json(
        { error: "Nie znaleziono żadnych pozycji w pliku. Sprawdź format pliku." },
        { status: 400 },
      );
    }

    const [batch] = await db
      .insert(importBatches)
      .values({
        source,
        filename: file.name,
        category,
        status: "uploaded",
        totalItems: items.length,
        errorItems: skipped,
      })
      .returning();

    const values = items.map((item) => ({
      importBatchId: batch.id,
      source,
      sourceId: item.sourceId,
      category,
      type: item.type,
      title: item.title,
      originalTitle: item.originalTitle,
      year: item.year,
      userRating: item.userRating,
      ratedAt: item.ratedAt,
      watchedAt: item.watchedAt,
      comment: item.comment,
      imdbId: item.imdbId,
      tmdbId: item.tmdbId,
      matchStatus: item.imdbId ? "matched" : "pending",
      matchConfidence: item.imdbId ? 100 : null,
    }));

    // insert in chunks to avoid exceeding parameter limits
    const chunkSize = 500;
    for (let i = 0; i < values.length; i += chunkSize) {
      await db.insert(mediaItems).values(values.slice(i, i + chunkSize));
    }

    const matchedCount = values.filter((v) => v.matchStatus === "matched").length;
    await db
      .update(importBatches)
      .set({ matchedItems: matchedCount, status: "ready", updatedAt: new Date() })
      .where(eq(importBatches.id, batch.id));

    return Response.json({ batchId: batch.id, totalItems: items.length, skipped, detectedFormat });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Nie udało się przetworzyć pliku." }, { status: 500 });
  }
}
