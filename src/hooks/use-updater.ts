"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type UpdaterStatus =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";

interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string;
}

interface ProgressInfo {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

interface UseUpdaterResult {
  isElectron: boolean;
  status: UpdaterStatus;
  updateInfo: UpdateInfo | null;
  progress: ProgressInfo | null;
  errorMessage: string | null;
  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
}

// Ponowne sprawdzenie nie może zrzucić UI z available/downloading/downloaded
const BUSY: UpdaterStatus[] = ["available", "downloading", "downloaded"];
const keep = (prev: UpdaterStatus, next: UpdaterStatus): UpdaterStatus =>
  BUSY.includes(prev) ? prev : next;

export function useUpdater(): UseUpdaterResult {
  const isElectron =
    typeof window !== "undefined" && !!(window as any).electronAPI;
  const [status, setStatus] = useState<UpdaterStatus>("idle");
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const listenersAttached = useRef(false);

  function attachListeners() {
    if (listenersAttached.current) return;
    listenersAttached.current = true;
    const api = (window as any).electronAPI;

    api.onUpdaterChecking(() => {
      setStatus((p) => keep(p, "checking"));
      setErrorMessage(null);
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
      setStatus("error");
      setErrorMessage(data.message);
    });
  }

  const checkForUpdates = useCallback(async () => {
    const api = (window as any).electronAPI;
    if (!api) return;
    setStatus((p) => keep(p, "checking"));
    const res = await api.checkForUpdates();
    if (!res.success) {
      // Np. tryb dev / build niespakowany — nie pokazujemy błędu użytkownikowi
      console.warn("[Updater] checkForUpdates:", res.error);
      setStatus((p) => keep(p, "idle"));
    }
  }, []);

  const downloadUpdate = useCallback(async () => {
    const api = (window as any).electronAPI;
    if (!api) return;
    setStatus("downloading");
    setProgress(null);
    setErrorMessage(null);
    const res = await api.downloadUpdate();
    if (!res.success) {
      setStatus("error");
      setErrorMessage(res.error ?? "Nie udało się pobrać aktualizacji");
    }
  }, []);

  const installUpdate = useCallback(async () => {
    const api = (window as any).electronAPI;
    if (!api) return;
    await api.installUpdate();
  }, []);

  useEffect(() => {
    const hasElectronApi = !!(window as any).electronAPI;
    if (!hasElectronApi) return;

    attachListeners();

    // Ciche sprawdzenie przy starcie — UI reaguje dopiero gdy przyjdzie event
    // Odrocz wywołanie, aby nie aktualizować stanu synchronicznie w efekcie.
    const checkTimer = window.setTimeout(() => {
      void checkForUpdates();
    }, 0);

    return () => window.clearTimeout(checkTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    isElectron,
    status,
    updateInfo,
    progress,
    errorMessage,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
  };
}