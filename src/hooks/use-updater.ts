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

export function useUpdater(): UseUpdaterResult {
  const [isElectron, setIsElectron] = useState(false);
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
      setStatus("checking");
      setErrorMessage(null);
    });

    api.onUpdaterAvailable((data: UpdateInfo) => {
      setStatus("available");
      setUpdateInfo(data);
    });

    api.onUpdaterNotAvailable(() => {
      setStatus("not-available");
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
    setStatus("checking");
    const res = await api.checkForUpdates();
    if (!res.success) {
      // Np. tryb dev / build niespakowany — nie pokazujemy błędu użytkownikowi
      console.warn("[Updater] checkForUpdates:", res.error);
      setStatus("idle");
    }
  }, []);

  const downloadUpdate = useCallback(async () => {
    const api = (window as any).electronAPI;
    if (!api) return;
    setStatus("downloading");
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
    setIsElectron(hasElectronApi);
    if (!hasElectronApi) return;

    attachListeners();

    // Ciche sprawdzenie przy starcie — UI reaguje dopiero gdy przyjdzie event
    checkForUpdates();
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