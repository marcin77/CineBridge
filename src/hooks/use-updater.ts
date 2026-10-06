"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ReleaseNotes } from "@/lib/release-notes";

export type UpdaterStatus =
  | "idle" | "checking" | "available" | "not-available"
  | "downloading" | "downloaded" | "error";

export interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: ReleaseNotes;
}

interface ProgressInfo {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

interface UseUpdaterResult {
  status: UpdaterStatus;
  updateInfo: UpdateInfo | null;
  progress: ProgressInfo | null;
  errorMessage: string | null;   // błąd pobierania
  checkError: string | null;     // błąd sprawdzania
  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
}

const BUSY: UpdaterStatus[] = ["available", "downloading", "downloaded"];
const keep = (prev: UpdaterStatus, next: UpdaterStatus): UpdaterStatus =>
  BUSY.includes(prev) ? prev : next;

export function useUpdater(): UseUpdaterResult {
  const [status, setStatus] = useState<UpdaterStatus>("idle");
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  const listenersAttached = useRef(false);
  const downloadingRef = useRef(false);

  function attachListeners() {
    if (listenersAttached.current) return;
    listenersAttached.current = true;
    const api = (window as any).electronAPI;

    api.onUpdaterChecking(() => {
      setStatus((p) => keep(p, "checking"));
      setCheckError(null);
    });

    api.onUpdaterAvailable((data: UpdateInfo) => {
      setStatus("available");
      setUpdateInfo(data);
    });

    api.onUpdaterNotAvailable(() => {
      setStatus((p) => keep(p, "not-available"));
    });

    api.onUpdaterProgress((data: ProgressInfo) => {
      setStatus("downloading");
      setProgress(data);
    });

    api.onUpdaterDownloaded((data: { version: string }) => {
      setStatus("downloaded");
      setUpdateInfo((prev) => prev ?? { version: data.version });
    });

    api.onUpdaterError((data: { message: string }) => {
      if (downloadingRef.current) {
        setStatus("error");
        setErrorMessage(data.message);
      } else {
        // błąd sprawdzania: nie ruszamy available/downloaded, tylko zdejmujemy "checking"
        setCheckError(data.message);
        setStatus((p) => (p === "checking" ? "idle" : p));
      }
    });
  }

  const checkForUpdates = useCallback(async () => {
    const api = (window as any).electronAPI;
    if (!api) return;
    setCheckError(null);
    setStatus((p) => keep(p, "checking"));
    const res = await api.checkForUpdates();
    if (!res.success) {
      // np. tryb dev (niespakowana aplikacja) albo brak sieci
      setCheckError(res.error ?? "Nie udało się sprawdzić aktualizacji");
      setStatus((p) => (p === "checking" ? "idle" : p));
    }
  }, []);

  const downloadUpdate = useCallback(async () => {
    const api = (window as any).electronAPI;
    if (!api) return;
    downloadingRef.current = true;
    setStatus("downloading");
    setProgress(null);
    setErrorMessage(null);
    try {
      const res = await api.downloadUpdate();
      if (!res.success) {
        setStatus("error");
        setErrorMessage(res.error ?? "Nie udało się pobrać aktualizacji");
      }
    } finally {
      downloadingRef.current = false;
    }
  }, []);

  const installUpdate = useCallback(async () => {
    const api = (window as any).electronAPI;
    if (!api) return;
    await api.installUpdate();
  }, []);

  useEffect(() => {
    if (!(window as any).electronAPI) return;
    attachListeners();
    // Defer the initial check so state updates do not run synchronously in the effect.
    const timeout = window.setTimeout(() => {
      void checkForUpdates(); // ciche sprawdzenie przy starcie
    }, 0);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    status, updateInfo, progress, errorMessage, checkError,
    checkForUpdates, downloadUpdate, installUpdate,
  };
}