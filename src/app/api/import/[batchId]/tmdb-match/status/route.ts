import { db } from "@/db";
import { mediaItems } from "@/db/schema";
import { and, count, eq, isNull, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const { batchId } = await params;
  const id = Number(batchId);

  const [{ value: remaining }] = await db
    .select({ value: count() })
    .from(mediaItems)
    .where(
      and(
        eq(mediaItems.importBatchId, id),
        isNull(mediaItems.tmdbId),
        isNull(mediaItems.imdbId),
        eq(mediaItems.tmdbSearched, false),
        inArray(mediaItems.type, ["movie", "show"]),
      ),
    );

  return Response.json({ remaining });
}