"use client";

import { useState, useEffect, useRef } from "react";
import {
  Play, Square, CheckCircle, XCircle, Loader2,
  Clock, ChevronDown, ChevronUp, Trash2, Settings, AlertTriangle,
} from "lucide-react";
import { useScraperSync } from "@/lib/scraper-sync-context";
import Link from "next/link";

export default function FilmwebSyncPanel() {
  const {
    isElectron, email, password,
    credsSaved, running, logs, lastEvent, status, done, error,
    showLogs, setShowLogs, handleStart, handleStop,
    refreshStatus, handleClearData, includeEpisodes, setIncludeEpisodes,
  } = useScraperSync();

  const [clearingData, setClearingData] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  async function onClearData() {
    if (!confirm("Czy na pewno chcesz usunąć lokalną bazę scrapera? (pliki CSV i historia synchronizacji)")) return;
    setClearingData(true);
    await handleClearData();
    setClearingData(false);
  }

  useEffect(() => {
    if (showLogs) logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, showLogs]);

  const percent = lastEvent?.percent ?? 0;
  const phaseLabel: Record<string, string> = {
    auth: "Logowanie…", init: "Inicjalizacja…", meta: "Pobieranie danych użytkownika…",
    filmy: "Synchronizacja filmów…", seriale: "Synchronizacja seriali…",
    "watchlist-filmy": "Watchlist (filmy)…", "watchlist-seriale": "Watchlist (seriale)…",
    listy: "Synchronizacja list…", done: "Zakończono", upload: "Importowanie do bazy…",
    error: "Błąd", stopped: "Zatrzymano",
    odcinki: "Oceny sezonów i odcinków…",
  };

  const hasCredentials = !!(email && password);

  if (!isElectron) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/5 dark:text-amber-300">
        Synchronizacja z Filmweb dostępna tylko w aplikacji desktopowej (Electron).
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status ostatniej sync */}
      {status && (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
          <Clock size={14} className="text-slate-400" />
          {status.lastSync ? (
            <span className="text-slate-600 dark:text-slate-300">
              Ostatnia sync:{" "}
              <strong className="text-slate-900 dark:text-white">
                {status.lastSync}
              </strong>
              {" · "}
              {status.totalItems} pozycji w bazie scrapera
            </span>
          ) : (
            <span className="text-slate-500 dark:text-slate-400">
              Brak poprzedniej synchronizacji
            </span>
          )}
        </div>
      )}

      {/* Brak credentials — info z linkiem do ustawień */}
      {!hasCredentials && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-400/20 dark:bg-amber-400/5">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-sm">
            <div className="mb-1 font-medium text-amber-700 dark:text-amber-300">
              Brak danych logowania Filmweb
            </div>
            <p className="mb-3 text-amber-600 dark:text-amber-400/80">
              Aby korzystać ze scrapera, skonfiguruj dane logowania do Filmweb.
            </p>
            <Link
              href="/settings"
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-200 dark:bg-amber-400/20 dark:text-amber-300 dark:hover:bg-amber-400/30"
            >
              <Settings size={12} />
              Przejdź do Ustawień
            </Link>
          </div>
        </div>
      )}

      {/* Opcje */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
        <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
          Opcje synchronizacji
        </h2>
        <label className="flex items-start gap-2 cursor-pointer text-xs text-slate-500 dark:text-slate-400">
          <input
            type="checkbox"
            checked={includeEpisodes}
            onChange={(e) => setIncludeEpisodes(e.target.checked)}
            disabled={running}
            className="mt-0.5 rounded"
          />
          <span>
            Pobieraj oceny sezonów i odcinków
            <span className="block text-[11px] text-slate-400 dark:text-slate-500">
              Filmweb nie ma zbiorczej listy — każdy sezon jest sprawdzany osobno.
              Seriale z sezonami są skanowane przy każdym uruchomieniu.
              Pierwszy raz może potrwać dłużej.
            </span>
          </span>
        </label>
      </div>

      {/* Przyciski */}
      <div className="flex gap-3">
        {!running ? (
          <button
            onClick={handleStart}
            disabled={!hasCredentials}
            className="flex items-center gap-2 rounded-xl bg-emerald-400 px-6 py-3 font-medium text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50"
            title={!hasCredentials ? "Skonfiguruj dane logowania w Ustawieniach" : undefined}
          >
            <Play size={16} />
            Synchronizuj z Filmweb
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="flex items-center gap-2 rounded-xl bg-red-500 px-6 py-3 font-medium text-white transition hover:bg-red-400"
          >
            <Square size={16} />
            Zatrzymaj
          </button>
        )}
        <button
          onClick={onClearData}
          disabled={running || clearingData}
          className="flex items-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-400/20 dark:text-red-400 dark:hover:bg-red-400/5"
          title="Wyczyść lokalną bazę danych scrapera"
        >
          <Trash2 size={14} />
          {clearingData ? "Czyszczenie..." : "Wyczyść bazę"}
        </button>
      </div>

      {/* Progress */}
      {running && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
          <div className="mb-3 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white">
              <Loader2 size={14} className="animate-spin text-emerald-500 dark:text-emerald-400" />
              {phaseLabel[lastEvent?.phase ?? ""] ?? lastEvent?.phase ?? "Przetwarzanie…"}
            </div>
            <span className="text-slate-500 dark:text-slate-400">{percent}%</span>
          </div>
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300 dark:bg-emerald-400"
              style={{ width: `${percent}%` }}
            />
          </div>
          {lastEvent?.current && lastEvent?.total && (
            <div className="flex justify-between text-xs text-slate-400">
              <span>{lastEvent.current} / {lastEvent.total}</span>
              {lastEvent.eta && <span>ETA: {lastEvent.eta}</span>}
            </div>
          )}
        </div>
      )}

      {/* Done */}
      {done && !running && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-400/20 dark:bg-emerald-400/5">
          <div className="mb-3 flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-300">
            <CheckCircle size={16} />
            Synchronizacja zakończona
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            {[
              { label: "Filmy dodane",          value: (done as any).stats?.moviesAdded },
              { label: "Filmy usunięte",         value: (done as any).stats?.moviesRemoved },
              { label: "Filmy zmienione",        value: (done as any).stats?.moviesUpdated },
              { label: "Seriale dodane",         value: (done as any).stats?.showsAdded },
              { label: "Watchlist +",            value: (done as any).stats?.watchlistAdded },
              { label: "Listy pozycji +",        value: (done as any).stats?.listsAdded },
              { label: "Sezony ocenione",        value: (done as any).stats?.seasonsAdded },
              { label: "Odcinki ocenione",       value: (done as any).stats?.episodesAdded },
              { label: "Seriale przeskanowane",  value: (done as any).stats?.showsScanned },
            ].map(({ label, value }) =>
              typeof value === "number" ? (
                <div
                  key={label}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/5"
                >
                  <div className="text-lg font-semibold text-slate-900 dark:text-white">
                    {value}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
                </div>
              ) : null,
            )}
          </div>
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Łącznie w bazie:{" "}
            <strong className="text-slate-900 dark:text-white">
              {(done as any).totalItems}
            </strong>{" "}
            pozycji
            {(done as any).uploadResult?.batchId && (
              <>
                {" · "}
                <a
                  href={`/import/${(done as any).uploadResult.batchId}`}
                  className="text-emerald-600 hover:underline dark:text-emerald-300"
                >
                  Otwórz import →
                </a>
              </>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && !running && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-400/5 dark:text-red-300">
          <XCircle size={16} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">Błąd synchronizacji</div>
            <div className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</div>
          </div>
        </div>
      )}

      {/* Logs */}
      {logs.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-950">
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="flex w-full items-center justify-between px-4 py-2 text-xs font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <span>Logi ({logs.length})</span>
            {showLogs ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showLogs && (
            <div className="h-48 overflow-y-auto border-t border-slate-200 p-4 font-mono text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
              {logs.map((log, i) => (
                <div
                  key={i}
                  className={`mb-0.5 ${
                    log.phase === "error"
                      ? "text-red-600 dark:text-red-400"
                      : log.phase === "done"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : ""
                  }`}
                >
                  <span className="text-slate-400 dark:text-slate-600">
                    [{log.phase}]
                  </span>{" "}
                  {log.message}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}