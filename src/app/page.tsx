import Link from "next/link";
import { db } from "@/db";
import { importBatches, mediaItems } from "@/db/schema";
import { count, eq, desc } from "drizzle-orm";
import { ArrowRight, Database, ListChecks, RefreshCw, Sparkles, Upload } from "lucide-react";
import { traktConfigured } from "@/lib/trakt";

export const dynamic = "force-dynamic";

async function getStats() {
  const [[{ value: totalItems }], [{ value: totalMatched }], [{ value: totalSynced }], batches] = await Promise.all([
    db.select({ value: count() }).from(mediaItems),
    db.select({ value: count() }).from(mediaItems).where(eq(mediaItems.matchStatus, "matched")),
    db.select({ value: count() }).from(mediaItems).where(eq(mediaItems.syncedToTrakt, true)),
    db.select().from(importBatches).orderBy(desc(importBatches.createdAt)).limit(5),
  ]);
  return { totalItems, totalMatched, totalSynced, batches };
}

export default async function DashboardPage() {
  const { totalItems, totalMatched, totalSynced, batches } = await getStats();
  const configured = traktConfigured();

  const stats = [
    { label: "Pozycje w bazie", value: totalItems, icon: Database, color: "from-sky-400 to-blue-500" },
    { label: "Dopasowane do Trakt", value: totalMatched, icon: ListChecks, color: "from-emerald-400 to-teal-500" },
    { label: "Zsynchronizowane", value: totalSynced, icon: RefreshCw, color: "from-fuchsia-400 to-purple-500" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <section className="mb-10 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
              <Sparkles size={13} /> Faza 1 · Filmweb → Trakt
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Przenieś swoją historię filmową bez ręcznego klepania.
            </h1>
            <p className="mt-3 max-w-2xl text-slate-400">
              Zaimportuj eksport danych z Filmweb (oceny, daty obejrzenia, komentarze, listy), automatycznie
              dopasuj tytuły do bazy Trakt i zsynchronizuj wszystko jednym kliknięciem — albo pobierz gotowy
              plik CSV.
            </p>
          </div>
          <Link
            href="/import"
            className="flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-3 font-medium text-slate-950 transition hover:bg-emerald-300"
          >
            <Upload size={18} /> Rozpocznij import <ArrowRight size={16} />
          </Link>
        </div>
        {!configured && (
          <div className="mt-6 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
            Konto Trakt nie jest jeszcze skonfigurowane — automatyczne dopasowywanie i synchronizacja są wyłączone,
            dopóki nie ustawisz <code className="rounded bg-black/30 px-1">TRAKT_CLIENT_ID</code> i{" "}
            <code className="rounded bg-black/30 px-1">TRAKT_CLIENT_SECRET</code>. Zobacz zakładkę{" "}
            <Link href="/connections" className="underline">
              Połączenia
            </Link>
            .
          </div>
        )}
      </section>

      <section className="mb-10 grid gap-4 sm:grid-cols-3">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${color} text-slate-950`}>
              <Icon size={18} />
            </div>
            <div className="text-2xl font-semibold text-white">{value}</div>
            <div className="text-sm text-slate-400">{label}</div>
          </div>
        ))}
      </section>

      <section className="mb-10 rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Ostatnie importy</h2>
          <Link href="/import" className="text-sm text-emerald-300 hover:underline">
            Zobacz wszystkie
          </Link>
        </div>
        {batches.length === 0 ? (
          <p className="text-sm text-slate-400">Brak importów. Zacznij od wgrania pliku eksportu z Filmweb.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {batches.map((b) => (
              <Link
                key={b.id}
                href={`/import/${b.id}`}
                className="flex items-center justify-between py-3 text-sm transition hover:opacity-80"
              >
                <div>
                  <div className="font-medium text-white">{b.filename}</div>
                  <div className="text-xs text-slate-500">
                    {b.category} · {b.totalItems} pozycji · status: {b.status}
                  </div>
                </div>
                <ArrowRight size={16} className="text-slate-500" />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-3 text-lg font-semibold text-white">Mapa drogowa</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { title: "Filmweb → Trakt", desc: "Import ocen, dat, komentarzy i list + eksport CSV.", status: "Gotowe" },
            { title: "Trakt → Filmweb (.csv)", desc: "Eksport odwrotny do ręcznego uzupełnienia Filmweb.", status: "Wkrótce" },
            { title: "Samodzielny scraper", desc: "Automatyczny, cykliczny scraper uruchamiany na własnym serwerze.", status: "Planowane" },
            { title: "Canal+ Online i inne VOD", desc: "Eksport historii oglądania z serwisów streamingowych.", status: "Planowane" },
          ].map((r) => (
            <div key={r.title} className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
              <div className="mb-2 inline-block rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-slate-300">
                {r.status}
              </div>
              <div className="font-medium text-white">{r.title}</div>
              <div className="mt-1 text-xs text-slate-400">{r.desc}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
