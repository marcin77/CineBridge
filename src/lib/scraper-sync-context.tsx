"use client";

import {
  createContext, useContext, useEffect, useRef, useState, ReactNode,
} from "react";

interface ProgressEvent {
  phase: string;
  message?: string;
  percent?: number;
  current?: number;
  total?: number;
  eta?: string;
  elapsed?: string;
  stats?: Record<string, number>;
  totalItems?: number;
  lastSync?: string;
  uploadResult?: { batchId?: number; totalItems?: number };
}

interface Status {
  running: boolean;
  lastSync: string | null;
  totalItems: number;
  lastProgress?: ProgressEvent | null;
}

interface ScraperSyncState {
  isElectron: boolean;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  remember: boolean;
  setRemember: (v: boolean) => void;
  credsSaved: boolean;
  running: boolean;
  logs: ProgressEvent[];
  lastEvent: ProgressEvent | null;
  status: Status | null;
  done: ProgressEvent | null;
  error: string | null;
  showLogs: boolean;
  setShowLogs: (v: boolean) => void;
  handleStart: () => Promise<void>;
  handleStop: () => Promise<void>;
  handleClearCredentials: () => Promise<void>;
  refreshStatus: () => Promise<Status | undefined>;
  handleClearData: () => Promise<void>;
}

const ScraperSyncContext = createContext<ScraperSyncState | null>(null);

export function ScraperSyncProvider({ children }: { children: ReactNode }) {
  // WAZNE: zaczynamy zawsze od false, tak samo jak SSR,
  // zeby uniknac hydration mismatch. Aktualizujemy dopiero w useEffect
  // (ktory nie wykonuje sie podczas SSR, tylko po zamontowaniu w przegladarce).
  const [isElectron, setIsElectron] = useState(false);

  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [remember, setRemember]     = useState(false);
  const [credsSaved, setCredsSaved] = useState(false);

  const [running, setRunning]       = useState(false);
  const [logs, setLogs]             = useState<ProgressEvent[]>([]);
  const [lastEvent, setLastEvent]   = useState<ProgressEvent | null>(null);
  const [status, setStatus]         = useState<Status | null>(null);
  const [done, setDone]             = useState<ProgressEvent | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [showLogs, setShowLogs]     = useState(false);

  const listenersAttached = useRef(false);

  function addLog(event: ProgressEvent) {
    setLastEvent(event);
    if (event.message) {
      setLogs((prev) => [...prev.slice(-200), event]);
    }
  }

  async function refreshStatus() {
    if (!(window as any).electronAPI) return;
    const api = (window as any).electronAPI;
    const s: Status = await api.getScraperStatus();
    setStatus(s);
    return s;
  }

  function attachListeners() {
    if (listenersAttached.current) return;
    listenersAttached.current = true;
    const api = (window as any).electronAPI;

    api.onScraperProgress((event: ProgressEvent) => {
      addLog(event);

      // Jesli to event z wynikiem uploadu, scal go z istniejacym stanem `done`
      if (event.phase === "upload" && event.uploadResult) {
        setDone((prev) => prev ? { ...prev, uploadResult: event.uploadResult } : prev);
      }
    });

    api.onScraperDone((result: ProgressEvent) => {
      setRunning(false);
      setDone(result);
      addLog({ ...result, phase: "done" });
      refreshStatus();
    });

    api.onScraperError((err: { error: string; isAborted: boolean }) => {
      setRunning(false);
      if (!err.isAborted) setError(err.error);
      refreshStatus();
    });
  }

  // Wykrycie Electrona + inicjalizacja - dopiero po zamontowaniu w przegladarce
  useEffect(() => {
    const hasElectronApi = !!(window as any).electronAPI;
    setIsElectron(hasElectronApi);

    if (!hasElectronApi) return;
    const api = (window as any).electronAPI;

    attachListeners();

    refreshStatus().then((s) => {
      if (s?.running) {
        setRunning(true);
        if (s.lastProgress) {
          setLastEvent(s.lastProgress);
        }
      }
    });

    api.loadCredentials().then(
      (creds: { email: string; password: string } | null) => {
        if (creds) {
          setEmail(creds.email);
          setPassword(creds.password);
          setCredsSaved(true);
          setRemember(true);
        }
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleStart() {
    if (!email || !password) return;
    const api = (window as any).electronAPI;

    if (remember) {
      await api.saveCredentials(email, password);
      setCredsSaved(true);
    }

    setRunning(true);
    setLogs([]);
    setDone(null);
    setError(null);

    attachListeners();

    const res = await api.startScraping({ email, password });
    if (!res.success) {
      setRunning(false);
      setError(res.error);
    }
  }

  async function handleStop() {
    const api = (window as any).electronAPI;
    await api.stopScraping();
  }

  async function handleClearCredentials() {
    const api = (window as any).electronAPI;
    await api.clearCredentials();
    setCredsSaved(false);
    setPassword("");
  }

  async function handleClearData() {
  const api = (window as any).electronAPI;
  const result = await api.clearScraperData();
  if (result.success) {
    await refreshStatus();
  }
}

  const value: ScraperSyncState = {
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
    handleClearData,
    refreshStatus,
  };

  return (
    <ScraperSyncContext.Provider value={value}>
      {children}
    </ScraperSyncContext.Provider>
  );
}

export function useScraperSync() {
  const ctx = useContext(ScraperSyncContext);
  if (!ctx) {
    throw new Error("useScraperSync must be used within ScraperSyncProvider");
  }
  return ctx;
}