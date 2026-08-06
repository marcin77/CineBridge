import Link from "next/link";
import { db } from "@/db";
import { importBatches } from "@/db/schema";
import { desc } from "drizzle-orm";
import UploadForm from "@/components/UploadForm";
import { ArrowRight, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const batches = await db.select().from(importBatches).orderBy(desc(importBatches.createdAt));

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="mb-2 text-2xl font-semibold text-white">Import z Filmweb</h1>
      <p className="mb-8 max-w-2xl text-sm text-slate-400">
        Filmweb nie udostępnia oficjalnego, prostego eksportu danych, dlatego zanim tu wgrasz plik, musisz go
        najpierw wygenerować jednym ze sprawdzonych, otwartoźródłowych narzędzi społeczności (albo przygotować
        własny plik w naszym uniwersalnym formacie).
      </p>

      <div className="mb-10 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">1. Wyeksportuj dane z Filmweb</h2>
          <ul className="space-y-4 text-sm text-slate-300">
            <li className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
              <div className="mb-1 flex items-center justify-between font-medium text-white">
                filmweb-export (Python)
                <a
                  className="flex items-center gap-1 text-xs text-emerald-300 hover:underline"
                  href="https://github.com/ppatrzyk/filmweb-export"
                  target="_blank"
                >
                  repo <ExternalLink size={12} />
                </a>
              </div>
              Eksportuje Twoje <b>oceny</b> filmów do CSV/JSON (tytuł, rok, ocena, data). Najlepszy do dużych
              bibliotek ocen.
            </li>
            <li className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
              <div className="mb-1 flex items-center justify-between font-medium text-white">
                Filmweb2Letterboxd (skrypt w konsoli przeglądarki)
                <a
                  className="flex items-center gap-1 text-xs text-emerald-300 hover:underline"
                  href="https://github.com/JSerwatka/Filmweb2Letterboxd"
                  target="_blank"
                >
                  repo <ExternalLink size={12} />
                </a>
              </div>
              Eksportuje <b>obejrzane</b> filmy/seriale oraz listę <b>„Chcę zobaczyć”</b> (watchlist) do CSV —
              uruchamiane bezpośrednio na Twoim koncie w przeglądarce.
            </li>
            <li className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
              <div className="mb-1 font-medium text-white">Własny plik / inne źródło</div>
              Możesz też przygotować plik ręcznie (lub wyeksportować z innego narzędzia) w naszym uniwersalnym
              formacie:{" "}
              <a className="text-emerald-300 hover:underline" href="/templates/filmweb-universal-template.csv">
                pobierz szablon CSV
              </a>
              .
            </li>
          </ul>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">2. Wgraj plik do CineBridge</h2>
          <UploadForm />
        </div>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Historia importów</h2>
        {batches.length === 0 ? (
          <p className="text-sm text-slate-400">Brak importów.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pb-3">Plik</th>
                  <th className="pb-3">Kategoria</th>
                  <th className="pb-3">Pozycje</th>
                  <th className="pb-3">Dopasowane</th>
                  <th className="pb-3">Zsynchronizowane</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {batches.map((b) => (
                  <tr key={b.id}>
                    <td className="py-3 font-medium text-white">{b.filename}</td>
                    <td className="py-3 text-slate-400">{b.category}</td>
                    <td className="py-3 text-slate-400">{b.totalItems}</td>
                    <td className="py-3 text-slate-400">{b.matchedItems}</td>
                    <td className="py-3 text-slate-400">{b.syncedItems}</td>
                    <td className="py-3">
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-300">{b.status}</span>
                    </td>
                    <td className="py-3 text-right">
                      <Link href={`/import/${b.id}`} className="inline-flex items-center gap-1 text-emerald-300 hover:underline">
                        Otwórz <ArrowRight size={14} />
                      </Link>
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
