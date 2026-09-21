import { db } from "@/db";
import { importBatches, mediaItems } from "@/db/schema";
import { asc, desc, eq } from "drizzle-orm";
import { buildCsv, csvFilename, type ExportFormat } from "@/lib/csv-export";
import { getExportItems } from "@/lib/export-utils";

export const dynamic = "force-dynamic";

const ALLOWED_FORMATS: ExportFormat[] = ["letterboxd", "trakt", "universal", "simkl"];

export async function GET(
  req: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const { batchId } = await params;
  const id     = Number(batchId);
  const url    = new URL(req.url);
  const fmt    = (url.searchParams.get("format") ?? "universal") as ExportFormat;

  if (!ALLOWED_FORMATS.includes(fmt)) {
    return Response.json({ error: "Nieznany format eksportu." }, { status: 400 });
  }

  const [batch] = await db.select().from(importBatches).where(eq(importBatches.id, id));
  if (!batch) return Response.json({ error: "Nie znaleziono importu." }, { status: 404 });

const onlyNew = new URL(req.url).searchParams.get("onlyNew") === "true";
const items = await getExportItems(id, onlyNew);


  const csv      = buildCsv(items, fmt);
  const filename = csvFilename(batch.filename, fmt);

  return new Response("\uFEFF" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
