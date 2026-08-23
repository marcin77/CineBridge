import { db } from "@/db";
import { importBatches, mediaItems } from "@/db/schema";
import { eq, count, desc } from "drizzle-orm";
import Link from "next/link";
import { Download, FileText, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ExportPage() {
  const batches = await db.select().from(importBatches).orderBy(desc(importBatches.createdAt));
  const itemCounts = await db
    .select({ batchId: mediaItems.importBatchId, value: count() })
    .from(mediaItems)
    .groupBy(mediaItems.importBatchId);
  const countMap = Object.fromEntries(itemCounts.map((r) => [r.batchId, r.value]));

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-2 text-2xl font-semibold text-slate-900 dark:text-white">Eksport danych</h1>
      <p className="mb-8 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
        Pobierz dane w formacie gotowym do importu w wybranym serwisie.
      </p>

      {/* Format cards */}
      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { name: "Letterboxd", desc: "Plik CSV gotowy do importu na letterboxd.com. Obsługuje tylko filmy. Oceny 0.5–5★, daty i recenzje.", format: "letterboxd", color: "from-orange-400 to-amber-500", url: "https://letterboxd.com/import/" },
          { name: "Trakt",      desc: "Format CSV dla trakt.tv. Uwaga: Trakt ograniczył API do 1 app/konto.", format: "trakt", color: "from-red-400 to-pink-500", url: "https://trakt.tv/settings" },
          { name: "Simkl",     desc: "Format CSV dla simkl.com. Obsługuje oceny (1-10), status watchlisty i daty.", format: "simkl", color: "from-blue-400 to-indigo-500", url: "https://simkl.com/apps/import/csv/" },
          { name: "Universalny", desc: "Pełny eksport ze wszystkimi polami. Idealne do archiwizacji.", format: "universal", color: "from-emerald-400 to-teal-500", url: null },
        ].map(({ name, desc, format, color, url }) => (
          <div key={format} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
            <div className={`mb-3 h-1.5 w-12 rounded-full bg-gradient-to-r ${color}`} />
            <div className="mb-1 font-semibold text-slate-900 dark:text-white">{name}</div>
            <p className="mb-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{desc}</p>
            {url && (
              <a href={url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-emerald-600 hover:underline dark:text-emerald-300">
                Import na {name} →
              </a>
            )}
          </div>
        ))}
      </section>

      {/* Batch list */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Wybierz import do eksportu</h2>
        {batches.length === 0 ? (
          <div className="py-6 text-center">
            <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">Brak zaimportowanych danych.</p>
            <Link href="/import" className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-300">
              Wgraj plik <ArrowRight size={14} />
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {batches.map((b) => (
              <div key={b.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-900/40">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <FileText size={16} className="text-slate-400" />
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">{b.filename}</div>
                      <div className="text-xs text-slate-500">
                        {countMap[b.id] ?? b.totalItems} pozycji · {new Date(b.createdAt).toLocaleDateString("pl-PL")}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {(["letterboxd", "universal", "trakt", "simkl"] as const).map((fmt) => (
                      <a key={fmt}
                        href={fmt === "letterboxd" ? `/api/import/${b.id}/export/letterboxd-zip` : `/api/import/${b.id}/export?format=${fmt}`}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-white/10 dark:bg-transparent dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                      >
                        <Download size={12} />
                        {fmt === "letterboxd" ? "Letterboxd ZIP" : fmt === "trakt" ? "Trakt" : fmt === "simkl" ? "Simkl" : "Universal"}
                      </a>
                    ))}
                    <Link href={`/import/${b.id}`} className="flex items-center gap-1 text-xs text-emerald-600 hover:underline dark:text-emerald-300">
                      Szczegóły <ArrowRight size={12} />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Tips */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Wskazówki importu</h2>
        <ul className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
          <li><strong className="text-slate-700 dark:text-slate-300">Letterboxd:</strong> Zaloguj się → Ustawienia → Import &amp; Export → Import z pliku CSV.</li>
          <li><strong className="text-slate-700 dark:text-slate-300">Trakt:</strong> Od 2026r. Trakt ograniczył API. Importuj ręcznie przez trakt.tv → Ustawienia.</li>
          <li><strong className="text-slate-700 dark:text-slate-300">Komentarze:</strong> CineBridge eksportuje komentarze jako pole „Review" (Letterboxd) lub „comment" (Trakt/Universal).</li>
          <li><strong className="text-slate-700 dark:text-slate-300">Simkl:</strong> Wejdź na simkl.com/apps/import/csv/ → wybierz plik → Upload and start import.</li>
        </ul>
      </section>
    </div>
  );
}
