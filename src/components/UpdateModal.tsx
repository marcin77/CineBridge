"use client";

import { X, Download, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import type { UpdaterStatus } from "@/hooks/use-updater";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

interface Props {
  open: boolean;
  onClose: () => void;
  status: UpdaterStatus;
  updateVersion: string | null;
  progress: { percent: number } | null;
  errorMessage: string | null;
  scraperRunning: boolean;
  onDownload: () => void;
  onInstall: () => void;
}

export default function UpdateModal({
  open,
  onClose,
  status,
  updateVersion,
  progress,
  errorMessage,
  scraperRunning,
  onDownload,
  onInstall,
}: Props) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-white"
        >
          <X size={16} />
        </button>

        {/* Nagłówek */}
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400 text-slate-950">
            <Download size={20} />
          </span>
          <div>
            <div className="font-semibold text-slate-900 dark:text-white">
              Dostępna aktualizacja
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              wersja {updateVersion ?? "?"}
            </div>
          </div>
        </div>

        {/* Porównanie wersji */}
        <div className="mb-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-white/10 dark:bg-white/5">
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Zainstalowana wersja</span>
            <span className="text-slate-900 dark:text-white">{APP_VERSION}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Dostępna wersja</span>
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              {updateVersion ?? "?"}
            </span>
          </div>
        </div>

        {/* Ostrzeżenie o scraperze */}
        {scraperRunning && (status === "available" || status === "downloading") && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-300/50 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            <span>
              Trwa synchronizacja z Filmweb. Instalacja aktualizacji przerwie
              proces scrapowania — zalecamy poczekać na zakończenie.
            </span>
          </div>
        )}

        {/* Błąd */}
        {status === "error" && errorMessage && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-300/50 bg-red-50 p-3 text-xs text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Pasek postępu */}
        {status === "downloading" && (
          <div className="mb-4">
            <div className="mb-1.5 flex justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Pobieranie...</span>
              <span>{progress?.percent ?? 0}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-400 transition-all"
                style={{ width: `${progress?.percent ?? 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Przyciski akcji */}
        {status === "downloaded" ? (
          <button
            onClick={onInstall}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-emerald-300"
          >
            <CheckCircle2 size={15} />
            Zainstaluj i uruchom ponownie
          </button>
        ) : status === "downloading" ? (
          <button
            disabled
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-medium text-slate-500 dark:bg-white/10 dark:text-slate-400"
          >
            <RefreshCw size={15} className="animate-spin" />
            Pobieranie...
          </button>
        ) : (
          <button
            onClick={onDownload}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-emerald-300"
          >
            <Download size={15} />
            Pobierz aktualizację
          </button>
        )}
      </div>
    </div>
  );
}