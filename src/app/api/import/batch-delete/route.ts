import { db } from "@/db";
import { importBatches, mediaItems } from "@/db/schema";
import { inArray, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function DELETE(req: Request) {
  try {
    const body = (await req.json()) as { ids: number[] };
    const ids = body?.ids;

    if (!Array.isArray(ids) || ids.length === 0) {
      return Response.json({ error: "Brak ID do usunięcia." }, { status: 400 });
    }

    for (const id of ids) {
      await db.delete(mediaItems).where(eq(mediaItems.importBatchId, id));
    }
    await db.delete(importBatches).where(inArray(importBatches.id, ids));

    return Response.json({ ok: true, deleted: ids.length });
  } catch (err) {
    console.error("[batch-delete]", err);
    return Response.json({ error: "Błąd usuwania." }, { status: 500 });
  }
}