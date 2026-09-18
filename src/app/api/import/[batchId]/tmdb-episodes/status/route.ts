import { db } from "@/db";
import { mediaItems } from "@/db/schema";
import { and, count, eq, isNotNull, isNull, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const { batchId } = await params;
  const id = Number(batchId);

  const shows = await db
    .select({ sourceId: mediaItems.sourceId })
    .from(mediaItems)
    .where(
      and(
        eq(mediaItems.importBatchId, id),
        eq(mediaItems.type, "show"),
        isNotNull(mediaItems.tmdbId),
      ),
    );

  const sourceIds = shows.map(s => s.sourceId).filter((s): s is string => !!s);

  if (sourceIds.length === 0) {
    return Response.json({ remaining: 0 });
  }

  const [{ value: remainingEpisodes }] = await db
    .select({ value: count() })
    .from(mediaItems)
    .where(
      and(
        eq(mediaItems.importBatchId, id),
        eq(mediaItems.type, "episode"),
        eq(mediaItems.tmdbSearched, false),
        inArray(mediaItems.parentShowId, sourceIds),
      ),
    );

  const [{ value: remainingSeasons }] = await db
    .select({ value: count() })
    .from(mediaItems)
    .where(
      and(
        eq(mediaItems.importBatchId, id),
        eq(mediaItems.type, "season"),
        eq(mediaItems.tmdbSearched, false), 
        inArray(mediaItems.parentShowId, sourceIds),
      ),
    );

  return Response.json({ remaining: remainingEpisodes + remainingSeasons });

}