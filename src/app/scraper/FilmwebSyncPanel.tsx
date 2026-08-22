"use client";

import { useState, useEffect, useRef } from "react";
import {
  Play, Square, RefreshCw, Eye, EyeOff,
  CheckCircle, XCircle, Loader2, Clock,
  ChevronDown, ChevronUp,Trash2,
} from "lucide-react";
import { useScraperSync } from "@/lib/scraper-sync-context";

export default function FilmwebSyncPanel() {
  const {
    isElectron,
    email, setEmail,
    password, setPassword,
    remember, setRemember,
    credsSaved,
    running,
    logs,
    lastEvent,
    status,
    done,
    error,
    showLogs, setShowLogs,
    handleStart,
    handleStop,
    handleClearCredentials,
    refreshStatus,
    handleClearData,
  } = useScraperSync();
  

  const [showPass, setShowPass] = useState(false);
  const [clearingData, setClearingData] = useState(false); // <- DODAJ
  const logsEndRef = useRef<HTMLDivElement>(null);

  async function onClearData() {
  if (!confirm("Czy na pewno chcesz usunąć lokalną bazę scrapera? (pliki CSV i historia synchronizacji)")) {
    return;
  }
  setClearingData(true);
  await handleClearData();
  setClearingData(false);
}

  // Auto-scroll logów (tylko gdy rozwinięte)
  useEffect(() => {
    if (showLogs) {
      logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, showLogs]);

  const percent = lastEvent?.percent ?? 0;
  const phaseLabel: Record<string, string> = {
    auth:              "Logowanie…",
    init:              "Inicjalizacja…",
    meta:              "Pobieranie danych użytkownika…",
    filmy:             "Synchronizacja filmów…",
    seriale:           "Synchronizacja seriali…",
    "watchlist-filmy": "Watchlist (filmy)…",
    "watchlist-seriale": "Watchlist (seriale)…",
    listy:             "Synchronizacja list…",
    done:              "Zakończono",
    upload:            "Importowanie do bazy…",
    error:             "Błąd",
    stopped:           "Zatrzymano",
  };

  if (!isElectron) {
    return (
      <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-6 text-center text-sm text-amber-300">
        Synchronizacja z Filmweb dostępna tylko w aplikacji desktopowej (Electron).
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status ostatniej synchronizacji */}
      {status && (
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
          <Clock size={14} className="text-slate-400" />
          {status.lastSync ? (
            <span className="text-slate-300">
              Ostatnia sync: <strong className="text-white">{status.lastSync}</strong>
              {" · "}{status.totalItems} pozycji w bazie scrapera
            </span>
          ) : (
            <span className="text-slate-400">Brak poprzedniej synchronizacji</span>
          )}
        </div>
      )}

      {/* Formularz logowania */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-4 text-sm font-semibold text-white">Dane logowania Filmweb</h2>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-slate-400">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={running}
              placeholder="twoj@email.pl"
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-400/50 focus:outline-none disabled:opacity-50"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-400">Hasło</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={running}
                placeholder="••••••••"
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5 pr-10 text-sm text-white placeholder-slate-500 focus:border-emerald-400/50 focus:outline-none disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                disabled={running}
                className="rounded"
              />
              Zapamiętaj dane logowania (zaszyfrowane)
            </label>
            {credsSaved && (
              <button
                onClick={handleClearCredentials}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Usuń zapisane dane
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Przyciski */}
      <div className="flex gap-3">
        {!running ? (
          <button
            onClick={handleStart}
            disabled={!email || !password}
            className="flex items-center gap-2 rounded-xl bg-emerald-400 px-6 py-3 font-medium text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50"
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
          onClick={refreshStatus}
          className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300 transition hover:bg-white/5"
        >
          <RefreshCw size={14} />
          Odśwież
        </button>
      </div>
        <button
          onClick={onClearData}
          disabled={running || clearingData}
          className="flex items-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-400/20 dark:text-red-400 dark:hover:bg-red-400/5"
          title="Wyczyść lokalną bazę danych scrapera"
        >
          <Trash2 size={14} />
          {clearingData ? "Czyszczenie..." : "Wyczyść bazę"}
        </button>
        
      {/* Progress bar */}
      {running && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="mb-3 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-white">
              <Loader2 size={14} className="animate-spin text-emerald-400" />
              {phaseLabel[lastEvent?.phase ?? ""] ?? lastEvent?.phase ?? "Przetwarzanie…"}
            </div>
            <span className="text-slate-400">{percent}%</span>
          </div>

          <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>

          {lastEvent?.current && lastEvent?.total && (
            <div className="flex justify-between text-xs text-slate-500">
              <span>{lastEvent.current} / {lastEvent.total}</span>
              {lastEvent.eta && <span>ETA: {lastEvent.eta}</span>}
            </div>
          )}
        </div>
      )}

      {/* Wynik końcowy */}
      {done && !running && (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-5">
          <div className="mb-3 flex items-center gap-2 font-medium text-emerald-300">
            <CheckCircle size={16} />
            Synchronizacja zakończona
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            {[
              { label: "Filmy dodane",     value: (done as any).stats?.moviesAdded },
              { label: "Filmy usunięte",   value: (done as any).stats?.moviesRemoved },
              { label: "Filmy zmienione",  value: (done as any).stats?.moviesUpdated },
              { label: "Seriale dodane",   value: (done as any).stats?.showsAdded },
              { label: "Watchlist +",      value: (done as any).stats?.watchlistAdded },
              { label: "Listy pozycji +",  value: (done as any).stats?.listsAdded },
            ].map(({ label, value }) => value !== undefined && (
              <div key={label} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <div className="text-lg font-semibold text-white">{value}</div>
                <div className="text-xs text-slate-400">{label}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-slate-400">
            Łącznie w bazie: <strong className="text-white">{(done as any).totalItems}</strong> pozycji
            {(done as any).uploadResult?.batchId && (
              <> · <a href={`/import/${(done as any).uploadResult.batchId}`} className="text-emerald-300 hover:underline">
                Otwórz import →
              </a></>
            )}
          </div>
        </div>
      )}

      {/* Błąd */}
      {error && !running && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-400/5 p-5 text-sm text-red-300">
          <XCircle size={16} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">Błąd synchronizacji</div>
            <div className="mt-1 text-xs text-red-400">{error}</div>
          </div>
        </div>
      )}

      {/* Live logi — zwijane */}
      {logs.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-slate-950">
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="flex w-full items-center justify-between px-4 py-2 text-xs font-medium text-slate-400 transition hover:text-slate-200"
          >
            <span>Logi ({logs.length})</span>
            {showLogs ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showLogs && (
            <div className="h-48 overflow-y-auto border-t border-white/10 p-4 font-mono text-xs text-slate-400">
              {logs.map((log, i) => (
                <div
                  key={i}
                  className={`mb-0.5 ${
                    log.phase === "error"
                      ? "text-red-400"
                      : log.phase === "done"
                      ? "text-emerald-400"
                      : ""
                  }`}
                >
                  <span className="text-slate-600">[{log.phase}]</span>{" "}
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