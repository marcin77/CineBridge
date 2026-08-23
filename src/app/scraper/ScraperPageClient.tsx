"use client";

import { useEffect, useState } from "react";
import FilmwebSyncPanel from "./FilmwebSyncPanel";
import ScraperClient from "./ScraperClient";
import { RefreshCw, Download } from "lucide-react";

interface Props {
  scriptContent: string;
}

export default function ScraperPageClient({ scriptContent }: Props) {
  const [isElectron, setIsElectron] = useState<boolean | null>(null);

  useEffect(() => {
    setIsElectron(!!(window as any).electronAPI);
  }, []);

  if (isElectron === null) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400 text-slate-950">
            <RefreshCw size={18} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Scraper Filmweb</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Ładowanie...</p>
          </div>
        </div>
      </div>
    );
  }

  if (isElectron) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-400/20 dark:bg-emerald-400/5">
          <Download size={18} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
          <div className="text-sm">
            <div className="mb-1 font-medium text-emerald-700 dark:text-emerald-300">
              Wersja desktop — pełna automatyzacja
            </div>
            <p className="text-emerald-600 dark:text-emerald-400/80">
              Używasz natywnego scrapera CineBridge. Automatyczne logowanie,
              obsługa captcha, pobieranie ulubionych, list i bezpośredni import do bazy.
            </p>
          </div>
        </div>

        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400 text-slate-950">
            <RefreshCw size={18} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Scraper Filmweb</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Automatyczna synchronizacja z natywną integracją
            </p>
          </div>
        </div>

        <FilmwebSyncPanel />
      </div>
    );
  }

  return <ScraperClient scriptContent={scriptContent} />;
}
