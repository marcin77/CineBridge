// src/components/UpdateBanner.tsx
"use client";

import { Download, CheckCircle2, RefreshCw, AlertTriangle, X } from "lucide-react";
import { useSyncExternalStore } from "react";
import type { UpdaterStatus } from "@/hooks/use-updater";

const DISMISS_KEY = "dismissedUpdateVersion";
const listeners = new Set<() => void>();

function subscribeToDismissedVersion(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback); // zmiany z innych okien
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function getDismissedVersion(): string | null {
  try {
    return localStorage.getItem(DISMISS_KEY);
  } catch {
    return null; // np. zablokowany storage
  }
}

function dismissVersion(version: string) {
  try {
    localStorage.setItem(DISMISS_KEY, version);
  } catch {
    /* ignorujemy, baner po prostu wróci po restarcie */
  }
  // zdarzenie `storage` NIE odpala się w karcie, która sama zapisuje,
  // więc subskrybentów trzeba powiadomić ręcznie
  listeners.forEach((l) => l());
}

interface Props {
  status: UpdaterStatus;
  updateVersion: string | null;
  progress: { percent: number } | null;
  scraperRunning: boolean;
  onDownload: () => void;
  onInstall: () => void;
  onDetails: () => void; // otwiera UpdateModal
}

export default function UpdateBanner({
  status, updateVersion, progress, scraperRunning, onDownload, onInstall, onDetails,
}: Props) {
  // localStorage czytamy w efekcie, żeby uniknąć hydration mismatch
  const dismissedVersion = useSyncExternalStore(
  subscribeToDismissedVersion,
  getDismissedVersion,
  () => null,
);

  const failed = status === "error" && !!updateVersion; // błąd pobierania, nie błąd sprawdzania (offline)

  const visible =
    status === "downloaded" ||
    status === "downloading" ||
    failed ||
    (status === "available" && updateVersion !== dismissedVersion);

  if (!visible) return null;

  const btn =
    "flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-1 text-xs font-medium text-emerald-300 transition hover:bg-slate-800";

  return (
    <div
      role="status"
      className={`flex items-center justify-between gap-4 px-4 py-2 text-sm ${
        failed ? "bg-rose-500 text-white" : "bg-emerald-400 text-slate-950"
      }`}
    >
      <div className="flex items-center gap-2">
        {failed ? <AlertTriangle size={16} /> :
         status === "downloaded" ? <CheckCircle2 size={16} /> :
         status === "downloading" ? <RefreshCw size={16} className="animate-spin" /> :
         <Download size={16} />}
        <span>
          {status === "available" && <>Dostępna nowa wersja <strong>{updateVersion}</strong></>}
          {status === "downloading" && <>Pobieranie wersji {updateVersion}… {progress?.percent ?? 0}%</>}
          {status === "downloaded" && (
            <>
              Wersja <strong>{updateVersion}</strong> jest gotowa do instalacji
              {scraperRunning && " (trwa synchronizacja, instalacja ją przerwie)"}
            </>
          )}
          {failed && <>Nie udało się pobrać wersji <strong>{updateVersion}</strong></>}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={onDetails} className="text-xs underline underline-offset-2">
          Szczegóły
        </button>
        {status === "available" && (
          <button onClick={onDownload} className={btn}>
            <Download size={12} /> Pobierz
          </button>
        )}
        {failed && (
          <button onClick={onDownload} className={btn}>
            <RefreshCw size={12} /> Ponów
          </button>
        )}
        {status === "downloaded" && (
          <button onClick={onInstall} className={btn}>
            Zainstaluj i uruchom ponownie
          </button>
        )}
        {status === "available" && (
          <button
  aria-label="Zamknij"
  onClick={() => {
    if (updateVersion) dismissVersion(updateVersion);
  }}
>
  <X size={16} />
</button>
        )}
      </div>
    </div>
  );
}