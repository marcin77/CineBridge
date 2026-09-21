import Link from "next/link";
import { db } from "@/db";
import { importBatches } from "@/db/schema";
import { desc } from "drizzle-orm";
import UploadForm from "@/components/UploadForm";
import { ArrowRight, ExternalLink } from "lucide-react";
import BatchListManager from "@/components/BatchListManager";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const batches = await db
    .select()
    .from(importBatches)
    .orderBy(desc(importBatches.createdAt));

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="mb-2 text-2xl font-semibold text-slate-900 dark:text-white">
        Import z Filmweb
      </h1>
      <p className="mb-8 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
        Wgraj plik CSV wygenerowany przez{" "}
        <Link
          href="/scraper"
          className="text-emerald-600 hover:underline dark:text-emerald-300"
        >
          skrypt scrapera
        </Link>{" "}
        lub inne obsługiwane narzędzie.
      </p>

      <div className="mb-10 grid gap-6 lg:grid-cols-2">
        {/* Tools list */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
          <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
            1. Skąd wziąć plik?
          </h2>
          <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <li className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-400/20 dark:bg-emerald-400/5">
              <div className="mb-1 flex items-center justify-between font-medium text-slate-900 dark:text-white">
                CineBridge Scraper
                <Link
                  href="/scraper"
                  className="flex items-center gap-1 text-xs text-emerald-600 hover:underline dark:text-emerald-300"
                >
                  Uruchom <ArrowRight size={12} />
                </Link>
              </div>
              <span className="text-xs text-emerald-600 dark:text-emerald-400/80">
                Zalecane
              </span>{" "}
              — Natywny scraper w aplikacji desktopowej. Automatycznie loguje,
              pobiera oceny, komentarze, watchlist, ulubione i listy.
            </li>
            <li className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-900/60">
              <div className="mb-1 flex items-center justify-between font-medium text-slate-900 dark:text-white">
                filmweb-export (Python)
                <a
                  className="flex items-center gap-1 text-xs text-emerald-600 hover:underline dark:text-emerald-300"
                  href="https://github.com/ppatrzyk/filmweb-export"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  repo <ExternalLink size={12} />
                </a>
              </div>
              Eksportuje oceny filmów do CSV/JSON. Wymaga Pythona.
            </li>
            <li className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-900/60">
              <div className="mb-1 flex items-center justify-between font-medium text-slate-900 dark:text-white">
                Filmweb2Letterboxd
                <a
                  className="flex items-center gap-1 text-xs text-emerald-600 hover:underline dark:text-emerald-300"
                  href="https://github.com/JSerwatka/Filmweb2Letterboxd"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  repo <ExternalLink size={12} />
                </a>
              </div>
              Skrypt JS w konsoli przeglądarki — eksportuje obejrzane i
              watchlist.
            </li>
            <li className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-900/60">
              <div className="mb-1 font-medium text-slate-900 dark:text-white">
                Własny plik CSV
              </div>
              Dowolny plik z kolumnami:{" "}
              <code className="text-xs text-slate-500">
                title, year, user_rating, watched_at, comment, list_name
              </code>
              .
            </li>
          </ul>
        </div>

        {/* Upload form */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
          <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
            2. Wgraj plik
          </h2>
          <UploadForm />
        </div>
      </div>

      {/* Historia importów */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
          Historia importów
        </h2>
        <BatchListManager
          batches={batches.map((b) => ({
            id: b.id,
            filename: b.filename,
            totalItems: b.totalItems,
            status: b.status,
            createdAt: b.createdAt,
          }))}
        />
      </section>
    </div>
  );
}