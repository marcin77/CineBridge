import { db } from "@/db";
import { importBatches, mediaItems } from "@/db/schema";
import { and, asc, count, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const id = Number(batchId);
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const pageSize = Math.min(200, Math.max(10, Number(url.searchParams.get("pageSize") ?? "50")));
  const statusFilter = url.searchParams.get("status");

  const [batch] = await db.select().from(importBatches).where(eq(importBatches.id, id));
  if (!batch) return Response.json({ error: "Nie znaleziono importu." }, { status: 404 });

  const whereClause = statusFilter
    ? and(eq(mediaItems.importBatchId, id), eq(mediaItems.matchStatus, statusFilter))
    : eq(mediaItems.importBatchId, id);

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(mediaItems)
    .where(whereClause);

  const items = await db
    .select()
    .from(mediaItems)
    .where(whereClause)
    .orderBy(asc(mediaItems.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const statusCounts = await db
    .select({ status: mediaItems.matchStatus, value: count() })
    .from(mediaItems)
    .where(eq(mediaItems.importBatchId, id))
    .groupBy(mediaItems.matchStatus);

  return Response.json({
    batch,
    items,
    pagination: { page, pageSize, total },
    statusCounts,
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const id = Number(batchId);
  await db.delete(importBatches).where(eq(importBatches.id, id));
  return Response.json({ ok: true });
}
