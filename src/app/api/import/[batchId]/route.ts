import { db } from "@/db";
import { importBatches, mediaItems } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const { batchId } = await params;
  const id = Number(batchId);

  const [batch] = await db.select().from(importBatches).where(eq(importBatches.id, id));
  if (!batch) return Response.json({ error: "Nie znaleziono importu." }, { status: 404 });

  const items = await db.select().from(mediaItems).where(eq(mediaItems.importBatchId, id));
  return Response.json({ batch, items });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const { batchId } = await params;
  const id = Number(batchId);

  await db.delete(importBatches).where(eq(importBatches.id, id));
  return Response.json({ ok: true });
}
