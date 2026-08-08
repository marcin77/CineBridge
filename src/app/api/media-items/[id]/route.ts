import { db } from "@/db";
import { mediaItems } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const itemId = Number(id);
  const body = await req.json();

  const update: Record<string, unknown> = { updatedAt: new Date() };

  if ("title" in body) update.title = body.title;
  if ("year" in body) update.year = body.year ? Number(body.year) : null;
  if ("userRating" in body) update.userRating = body.userRating ? Number(body.userRating) : null;
  if ("comment" in body) update.comment = body.comment;
  if ("watchedAt" in body) update.watchedAt = body.watchedAt ? new Date(body.watchedAt) : null;
  if ("ratedAt" in body) update.ratedAt = body.ratedAt ? new Date(body.ratedAt) : null;
  if ("category" in body) update.category = body.category;
  if ("matchStatus" in body) update.matchStatus = body.matchStatus;

  if ("selectedMatch" in body && body.selectedMatch) {
    const m = body.selectedMatch;
    update.imdbId = m.imdbId ?? null;
    update.tmdbId = m.tmdbId ?? null;
    update.traktId = m.traktId ?? null;
    update.traktType = m.type ?? null;
    update.matchedTitle = m.title ?? null;
    update.matchedYear = m.year ?? null;
    update.matchStatus = "matched";
    update.matchConfidence = 100;
  }

  const [updated] = await db.update(mediaItems).set(update).where(eq(mediaItems.id, itemId)).returning();
  if (!updated) return Response.json({ error: "Nie znaleziono pozycji." }, { status: 404 });
  return Response.json({ item: updated });
}
