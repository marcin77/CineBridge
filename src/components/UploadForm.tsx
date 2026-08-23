"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useEffect } from "react";
import { UploadCloud, X, AlertCircle } from "lucide-react";

const SESSION_KEY = "uploadForm_fileName";

export default function UploadForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [restoredName, setRestoredName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) setRestoredName(saved);
  }, []);

  function handleFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setRestoredName(null);
    try { sessionStorage.setItem(SESSION_KEY, file.name); } catch {}
    setError(null);
  }

  function clearFile() {
    setFileName(null);
    setRestoredName(null);
    sessionStorage.removeItem(SESSION_KEY);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (fileRef.current && file) {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileRef.current.files = dt.files;
      handleFile(file);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError(restoredName
        ? `Wybierz plik ponownie — poprzednio wybrany „${restoredName}" nie jest już dostępny.`
        : "Wybierz plik CSV lub JSON.");
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("source", "filmweb");
      const res = await fetch("/api/import/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Błąd importu");
      sessionStorage.removeItem(SESSION_KEY);
      router.push(`/import/${data.batchId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nieznany błąd");
    } finally {
      setLoading(false);
    }
  }

  const fileReady = !!fileName && !!fileRef.current?.files?.[0];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {restoredName && !fileName && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/5 dark:text-amber-300">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">Poprzednio wybrany plik</div>
            <div className="mt-0.5 text-xs text-amber-600 dark:text-amber-400/80">
              „{restoredName}" — wybierz go ponownie, aby kontynuować import.
            </div>
          </div>
          <button type="button" onClick={clearFile} className="ml-auto text-amber-400 hover:text-amber-600 dark:text-amber-400/60 dark:hover:text-amber-300">
            <X size={14} />
          </button>
        </div>
      )}

      <label
        htmlFor="file-upload"
        className={`relative flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center transition ${
          dragging
            ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-400/10"
            : fileName
            ? "border-emerald-400/40 bg-emerald-50 dark:bg-emerald-400/5"
            : restoredName
            ? "border-amber-300 bg-amber-50 hover:border-amber-400 dark:border-amber-400/40 dark:bg-amber-400/5 dark:hover:border-amber-400/60"
            : "border-slate-300 bg-slate-50 hover:border-emerald-400/50 dark:border-white/15 dark:bg-slate-900/60"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <UploadCloud size={32} className={fileName ? "text-emerald-500" : restoredName ? "text-amber-400" : "text-emerald-500"} />

        {fileName ? (
          <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
            {fileName}
            <button type="button" onClick={(e) => { e.preventDefault(); clearFile(); }}
              className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
              <X size={14} />
            </button>
          </div>
        ) : restoredName ? (
          <div className="space-y-1">
            <p className="text-sm font-medium text-amber-600 dark:text-amber-300">Wybierz „{restoredName}" ponownie</p>
            <p className="text-xs text-amber-500 dark:text-amber-400/70">lub przeciągnij inny plik</p>
          </div>
        ) : (
          <>
            <span className="text-sm text-slate-600 dark:text-slate-300">Przeciągnij plik lub kliknij, aby wybrać</span>
            <span className="text-xs text-slate-400 dark:text-slate-500">Obsługiwane: filmweb-export, Filmweb2Letterboxd, CineBridge CSV</span>
          </>
        )}

        <input id="file-upload" ref={fileRef} type="file" accept=".csv,.json,text/csv,application/json"
          className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
      </label>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-300">
          {error}
        </p>
      )}

      <button type="submit" disabled={loading || (!fileReady && !restoredName)}
        className="w-full rounded-lg bg-emerald-400 px-4 py-2.5 font-medium text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50">
        {loading ? "Importowanie…" : restoredName && !fileName ? "Wybierz plik, aby importować" : "Importuj plik"}
      </button>
    </form>
  );
}
