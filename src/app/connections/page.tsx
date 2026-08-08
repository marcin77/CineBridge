import TraktConnectCard from "@/components/TraktConnectCard";
import { Server, Tv, FileDown } from "lucide-react";

export const dynamic = "force-dynamic";

export default function ConnectionsPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-2 text-2xl font-semibold text-white">Połączenia</h1>
      <p className="mb-8 text-sm text-slate-400">
        Zarządzaj kontem Trakt używanym do synchronizacji oraz zobacz status kolejnych integracji.
      </p>

      <TraktConnectCard />

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-slate-300">
            <FileDown size={16} />
          </div>
          <div className="font-medium text-white">Trakt → Filmweb (.csv)</div>
          <p className="mt-1 text-xs text-slate-400">
            Eksport odwrotny — pobierz swoją bibliotekę z Trakt jako plik gotowy do ręcznego uzupełnienia
            profilu Filmweb (który nie ma publicznego API do importu).
          </p>
          <div className="mt-3 inline-block rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-slate-300">
            Planowane
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-slate-300">
            <Server size={16} />
          </div>
          <div className="font-medium text-white">Samodzielny scraper</div>
          <p className="mt-1 text-xs text-slate-400">
            Dockerowy, cykliczny (cron) scraper uruchamiany na Twoim własnym serwerze, korzystający z Twojej
            sesji przeglądarki — bez przechowywania danych logowania na naszych serwerach.
          </p>
          <div className="mt-3 inline-block rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-slate-300">
            Planowane
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-slate-300">
            <Tv size={16} />
          </div>
          <div className="font-medium text-white">Canal+ Online i inne VOD</div>
          <p className="mt-1 text-xs text-slate-400">
            Import historii oglądania z serwisów streamingowych (start: Canal+ Online) — wymaga rozpoznania
            wewnętrznego API danego serwisu i Twojej własnej sesji.
          </p>
          <div className="mt-3 inline-block rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-slate-300">
            Planowane
          </div>
        </div>
      </div>
    </div>
  );
}
