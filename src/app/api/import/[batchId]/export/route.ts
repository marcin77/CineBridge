import { db } from "@/db";
import { importBatches, mediaItems } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { buildTraktCsv } from "@/lib/csv-export";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const id = Number(batchId);
  const [batch] = await db.select().from(importBatches).where(eq(importBatches.id, id));
  if (!batch) return Response.json({ error: "Nie znaleziono importu." }, { status: 404 });

  const items = await db
    .select()
    .from(mediaItems)
    .where(eq(mediaItems.importBatchId, id))
    .orderBy(asc(mediaItems.id));

  const csv = buildTraktCsv(items);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="trakt-import-${batch.filename.replace(/\.[^.]+$/, "")}.csv"`,
    },
  });
}
