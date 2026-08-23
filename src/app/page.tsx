import Link from "next/link";
import { db } from "@/db";
import { importBatches, mediaItems } from "@/db/schema";
import { count, desc } from "drizzle-orm";
import {
  ArrowRight, Database, Download, Sparkles, Upload, Code2, FileText,
} from "lucide-react";

export const dynamic = "force-dynamic";

async function getStats() {
  const [[{ value: totalItems }], batches] = await Promise.all([
    db.select({ value: count() }).from(mediaItems),
    db.select().from(importBatches).orderBy(desc(importBatches.createdAt)).limit(5),
  ]);
  return { totalItems, batches };
}

export default async function DashboardPage() {
  const { totalItems, batches } = await getStats();

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      {/* Hero */}
      <section className="mb-10 overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 p-8 dark:border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-400 dark:text-emerald-300">
              <Sparkles size={13} /> Filmweb → Letterboxd / Trakt / CSV
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Przenieś swoją historię filmową<br className="hidden sm:block" /> bez ręcznego klepania.
            </h1>
            <p className="mt-3 max-w-2xl text-slate-300 dark:text-slate-400">
              Użyj wbudowanego scrapera (wersja desktop) lub skryptu przeglądarki,
              aby wyeksportować oceny, komentarze i listy z Filmweb. Następnie wgraj
              plik CSV do CineBridge i pobierz gotowy eksport dla Letterboxd, Trakt
              lub dowolnego innego serwisu.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Link
              href="/scraper"
              className="flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-3 font-medium text-slate-950 transition hover:bg-emerald-300"
            >
              <Code2 size={18} /> Scraper Filmweb <ArrowRight size={16} />
            </Link>
            <Link
              href="/import"
              className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/20"
            >
              <Upload size={16} /> Wgraj plik CSV
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="mb-10 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Pozycje w bazie",     value: totalItems,     icon: Database, color: "from-sky-400 to-blue-500" },
          { label: "Pliki do eksportu",   value: batches.length, icon: FileText,  color: "from-emerald-400 to-teal-500" },
          { label: "Obsługiwane formaty", value: 3,              icon: Download,  color: "from-fuchsia-400 to-purple-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
            <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${color} text-slate-950`}>
              <Icon size={18} />
            </div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-white">{value}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section className="mb-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
        <h2 className="mb-6 text-lg font-semibold text-slate-900 dark:text-white">Jak to działa?</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              step: "1",
              title: "Scraper Filmweb",
              desc: "Użyj wbudowanego scrapera (desktop) lub skryptu JS który wklej w konsolę DevTools na filmweb.pl — automatycznie pobiera oceny, komentarze i listy.",
              href: "/scraper",
              color: "from-sky-400 to-blue-500",
            },
            {
              step: "2",
              title: "Import pliku CSV",
              desc: "Wgraj wygenerowany plik CSV do CineBridge. Obsługiwane formaty: filmweb-export, Filmweb2Letterboxd, własny.",
              href: "/import",
              color: "from-emerald-400 to-teal-500",
            },
            {
              step: "3",
              title: "Eksport do wybranego serwisu",
              desc: "Pobierz gotowy CSV dla Letterboxd, Trakt lub universalny format. Wszystko z komentarzami i listami.",
              href: "/export",
              color: "from-fuchsia-400 to-purple-500",
            },
          ].map(({ step, title, desc, href, color }) => (
            <Link
              key={step}
              href={href}
              className="group relative rounded-xl border border-slate-200 bg-slate-50 p-5 transition hover:border-slate-300 hover:bg-slate-100 dark:border-white/10 dark:bg-slate-900/60 dark:hover:border-white/20 dark:hover:bg-slate-900"
            >
              <div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${color} text-xs font-bold text-slate-950`}>
                {step}
              </div>
              <div className="font-medium text-slate-900 dark:text-white">{title}</div>
              <div className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{desc}</div>
              <ArrowRight size={14} className="absolute right-4 top-5 text-slate-400 transition group-hover:text-slate-600 dark:text-slate-600 dark:group-hover:text-slate-300" />
            </Link>
          ))}
        </div>
      </section>

      {/* Recent imports */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Ostatnie importy</h2>
          <Link href="/import" className="text-sm text-emerald-600 hover:underline dark:text-emerald-300">
            Zobacz wszystkie
          </Link>
        </div>
        {batches.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Brak importów.{" "}
            <Link href="/scraper" className="text-emerald-600 hover:underline dark:text-emerald-300">
              Zacznij od scrapera →
            </Link>
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {batches.map((b) => (
              <Link
                key={b.id}
                href={`/import/${b.id}`}
                className="flex items-center justify-between py-3 text-sm transition hover:opacity-80"
              >
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">{b.filename}</div>
                  <div className="text-xs text-slate-500">
                    {b.category} · {b.totalItems} pozycji · {new Date(b.createdAt).toLocaleDateString("pl-PL")}
                  </div>
                </div>
                <ArrowRight size={16} className="text-slate-400 dark:text-slate-500" />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}