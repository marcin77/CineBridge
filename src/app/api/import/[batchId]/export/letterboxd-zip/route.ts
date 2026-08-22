import { db } from "@/db";
import { importBatches, mediaItems } from "@/db/schema";
import { asc, desc, eq } from "drizzle-orm";
import { buildLetterboxdZipEntries } from "@/lib/csv-export";
import JSZip from "jszip";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const { batchId } = await params;
  const id = Number(batchId);

  const [batch] = await db
    .select()
    .from(importBatches)
    .where(eq(importBatches.id, id));
  if (!batch) {
    return Response.json({ error: "Nie znaleziono importu." }, { status: 404 });
  }

const items = await db
  .select()
  .from(mediaItems)
  .where(eq(mediaItems.importBatchId, id))
  .orderBy(
    desc(mediaItems.ratedAt),
    desc(mediaItems.watchedAt),
    asc(mediaItems.title)
  );

  const entries = buildLetterboxdZipEntries(items);

  if (entries.length === 0) {
    return Response.json({ error: "Brak danych do eksportu." }, { status: 400 });
  }

  const zip = new JSZip();

  // Dodaj README
  zip.file(
    "README.txt",
    `CineBridge — eksport dla Letterboxd
====================================

Pliki w tym archiwum:

- watched.csv      → Zaimportuj na letterboxd.com/import/
                     (Historia oglądania z ocenami i recenzjami)

- watchlist.csv    → Zaimportuj jako "Watchlist" na letterboxd.com/import/
                     (Filmy do obejrzenia)

- lists/           → Każdy plik to osobna lista
                     Utwórz listę ręcznie na Letterboxd, potem
                     zaimportuj plik przez ustawienia listy.

Instrukcja:
1. Wejdź na https://letterboxd.com/import/
2. Wybierz plik watched.csv → Import
3. Powtórz dla watchlist.csv (wybierz "Watchlist")
4. Listy importuj osobno przez każdą listę na Letterboxd

Data eksportu: ${new Date().toLocaleString("pl-PL")}
Źródło: ${batch.filename}
`,
  );

  for (const entry of entries) {
    zip.file(entry.filename, "\uFEFF" + entry.content);
  }

const zipUint8 = await zip.generateAsync({
  type: "uint8array",
  compression: "DEFLATE",
  compressionOptions: { level: 6 },
});

// Konwertuj na ArrayBuffer — akceptowany przez Response jako BodyInit
const zipBuffer = zipUint8.buffer.slice(
  zipUint8.byteOffset,
  zipUint8.byteOffset + zipUint8.byteLength
) as ArrayBuffer;

const base = batch.filename.replace(/\.[^.]+$/, "");
const zipFilename = `cinebridge-letterboxd-${base}.zip`;

return new Response(zipBuffer, {
  headers: {
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="${zipFilename}"`,
  },
});
}