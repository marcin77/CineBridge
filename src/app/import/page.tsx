import Link from "next/link";
import { db } from "@/db";
import { importBatches } from "@/db/schema";
import { desc } from "drizzle-orm";
import UploadForm from "@/components/UploadForm";
import { ArrowRight, ExternalLink, FileText, Trash2 } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  uploaded:  "Wczytano",
  ready:     "Gotowe",
  completed: "Zakończono",
  failed:    "Błąd",
};

const STATUS_COLOR: Record<string, string> = {
  uploaded:  "bg-sky-400/20 text-sky-300",
  ready:     "bg-emerald-400/20 text-emerald-300",
  completed: "bg-fuchsia-400/20 text-fuchsia-300",
  failed:    "bg-red-400/20 text-red-300",
};

export default async function ImportPage() {
  const batches = await db.select().from(importBatches).orderBy(desc(importBatches.createdAt));

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="mb-2 text-2xl font-semibold text-white">Import z Filmweb</h1>
      <p className="mb-8 max-w-2xl text-sm text-slate-400">
        Wgraj plik CSV wygenerowany przez{" "}
        <Link href="/scraper" className="text-emerald-300 hover:underline">
          skrypt scrapera
        </Link>{" "}
        lub inne obsługiwane narzędzie.
      </p>

      <div className="mb-10 grid gap-6 lg:grid-cols-2">
        {/* Tools list */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">1. Skąd wziąć plik?</h2>
          <ul className="space-y-3 text-sm text-slate-300">
            <li className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4">
              <div className="mb-1 flex items-center justify-between font-medium text-white">
                CineBridge Scraper
                <Link
                  href="/scraper"
                  className="flex items-center gap-1 text-xs text-emerald-300 hover:underline"
                >
                  Instrukcja <ArrowRight size={12} />
                </Link>
              </div>
              <span className="text-xs text-emerald-400/80">Zalecane</span> — Wbudowany skrypt JS
              uruchamiany w przeglądarce. Zbiera oceny, komentarze, watchlist i ulubione.
            </li>
            <li className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
              <div className="mb-1 flex items-center justify-between font-medium text-white">
                filmweb-export (Python)
                <a
                  className="flex items-center gap-1 text-xs text-emerald-300 hover:underline"
                  href="https://github.com/ppatrzyk/filmweb-export"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  repo <ExternalLink size={12} />
                </a>
              </div>
              Eksportuje oceny filmów do CSV/JSON. Wymaga Pythona.
            </li>
            <li className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
              <div className="mb-1 flex items-center justify-between font-medium text-white">
                Filmweb2Letterboxd
                <a
                  className="flex items-center gap-1 text-xs text-emerald-300 hover:underline"
                  href="https://github.com/JSerwatka/Filmweb2Letterboxd"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  repo <ExternalLink size={12} />
                </a>
              </div>
              Skrypt JS w konsoli przeglądarki — eksportuje obejrzane i watchlist.
            </li>
            <li className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
              <div className="mb-1 font-medium text-white">Własny plik CSV</div>
              Dowolny plik z kolumnami: <code className="text-xs text-slate-400">title, year, user_rating, watched_at, comment, list_name</code>.
            </li>
          </ul>
        </div>

        {/* Upload form */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">2. Wgraj plik</h2>
          <UploadForm />
        </div>
      </div>

      {/* History */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Historia importów</h2>
        {batches.length === 0 ? (
          <p className="text-sm text-slate-400">Brak importów.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pb-3 pr-4">Plik</th>
                  <th className="pb-3 pr-4">Pozycje</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3 pr-4">Data</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {batches.map((b) => (
                  <tr key={b.id} className="group">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2 font-medium text-white">
                        <FileText size={14} className="text-slate-500" />
                        {b.filename}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-slate-400">{b.totalItems}</td>
                    <td className="py-3 pr-4">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[b.status] ?? "bg-white/10 text-slate-300"}`}>
                        {STATUS_LABEL[b.status] ?? b.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-500 text-xs">
                      {new Date(b.createdAt).toLocaleString("pl-PL")}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <form action={`/api/import/${b.id}`} method="DELETE" className="hidden" />
                        <Link
                          href={`/import/${b.id}`}
                          className="inline-flex items-center gap-1 text-emerald-300 hover:underline text-xs"
                        >
                          Otwórz <ArrowRight size={12} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
