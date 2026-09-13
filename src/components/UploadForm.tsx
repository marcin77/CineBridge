"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { UploadCloud, X, AlertCircle } from "lucide-react";

const DB_NAME = "cinebridge-local";
const DB_VERSION = 1;
const STORE_NAME = "pending-uploads";
const FILE_KEY = "pending-import";

interface StoredFile {
  name: string;
  type: string;
  lastModified: number;
  blob: Blob;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function savePendingFile(file: File): Promise<void> {
  const db = await openDb();

  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);

      const data: StoredFile = {
        name: file.name,
        type: file.type,
        lastModified: file.lastModified,
        blob: file,
      };

      store.put(data, FILE_KEY);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

async function loadPendingFile(): Promise<File | null> {
  const db = await openDb();

  try {
    const stored = await new Promise<StoredFile | undefined>(
      (resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const request = tx.objectStore(STORE_NAME).get(FILE_KEY);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }
    );

    if (!stored) return null;

    return new File([stored.blob], stored.name, {
      type: stored.type,
      lastModified: stored.lastModified,
    });
  } finally {
    db.close();
  }
}

async function deletePendingFile(): Promise<void> {
  const db = await openDb();

  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");

      tx.objectStore(STORE_NAME).delete(FILE_KEY);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export default function UploadForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [restored, setRestored] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function restoreFile() {
      try {
        const savedFile = await loadPendingFile();

        if (!cancelled && savedFile) {
          setFile(savedFile);
          setRestored(true);
        }
      } catch (err) {
        console.error("[Upload] Nie udało się odtworzyć pliku:", err);
      } finally {
        if (!cancelled) {
          setRestoring(false);
        }
      }
    }

    restoreFile();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleFile(selectedFile: File | undefined) {
    if (!selectedFile) return;

    setFile(selectedFile);
    setRestored(false);
    setError(null);

    try {
      await savePendingFile(selectedFile);
    } catch (err) {
      console.error("[Upload] Nie udało się zapisać pliku:", err);

      // Sam import nadal może działać, nawet jeśli IndexedDB zawiedzie.
      setError(
        "Plik został wybrany, ale nie udało się zapisać go na wypadek restartu."
      );
    }
  }

  async function clearFile() {
    setFile(null);
    setRestored(false);
    setError(null);

    if (fileRef.current) {
      fileRef.current.value = "";
    }

    try {
      await deletePendingFile();
    } catch (err) {
      console.error("[Upload] Nie udało się usunąć zapisanego pliku:", err);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);

    const droppedFile = e.dataTransfer.files?.[0];

    if (droppedFile) {
      handleFile(droppedFile);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("Wybierz plik CSV lub JSON.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("source", "filmweb");

      const res = await fetch("/api/import/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Błąd importu");
      }

      // Import zakończony — kopia nie jest już potrzebna.
      await deletePendingFile();

      setFile(null);
      setRestored(false);

      router.push(`/import/${data.batchId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nieznany błąd");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {restored && file && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/5 dark:text-amber-300">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />

          <div>
            <div className="font-medium">Niedokończony import</div>

            <div className="mt-0.5 text-xs text-amber-600 dark:text-amber-400/80">
              „{file.name}” — plik jest zapisany lokalnie i gotowy do importu.
            </div>
          </div>

          <button
            type="button"
            onClick={clearFile}
            className="ml-auto text-amber-400 hover:text-amber-600 dark:text-amber-400/60 dark:hover:text-amber-300"
            title="Usuń niedokończony import"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <label
        htmlFor="file-upload"
        className={`relative flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center transition ${
          dragging
            ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-400/10"
            : file
              ? "border-emerald-400/40 bg-emerald-50 dark:bg-emerald-400/5"
              : "border-slate-300 bg-slate-50 hover:border-emerald-400/50 dark:border-white/15 dark:bg-slate-900/60"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <UploadCloud
          size={32}
          className={file ? "text-emerald-500" : "text-emerald-500"}
        />

        {restoring ? (
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Sprawdzanie niedokończonego importu…
          </span>
        ) : file ? (
          <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
            {file.name}

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                clearFile();
              }}
              className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <>
            <span className="text-sm text-slate-600 dark:text-slate-300">
              Przeciągnij plik lub kliknij, aby wybrać
            </span>

            <span className="text-xs text-slate-400 dark:text-slate-500">
              Obsługiwane: filmweb-export, Filmweb2Letterboxd, CineBridge CSV
            </span>
          </>
        )}

        <input
          id="file-upload"
          ref={fileRef}
          type="file"
          accept=".csv,.json,text/csv,application/json"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </label>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || restoring || !file}
        className="w-full rounded-lg bg-emerald-400 px-4 py-2.5 font-medium text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50"
      >
        {loading
          ? "Importowanie…"
          : restored
            ? "Dokończ import"
            : "Importuj plik"}
      </button>
    </form>
  );
}