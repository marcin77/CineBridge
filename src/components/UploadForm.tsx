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

  // Przywróć nazwę pliku z sessionStorage po powrocie na zakładkę
  useEffect(() => {
    console.log("[UploadForm] useEffect mount");
    const saved = sessionStorage.getItem(SESSION_KEY);
    console.log("[UploadForm] sessionStorage.getItem:", saved);
    if (saved) {
      setRestoredName(saved);
    }
  }, []);

  function handleFile(file: File | undefined) {
    console.log("[UploadForm] handleFile called, file:", file);
    if (!file) return;

    setFileName(file.name);
    setRestoredName(null);

    try {
      sessionStorage.setItem(SESSION_KEY, file.name);
      const check = sessionStorage.getItem(SESSION_KEY);
      console.log("[UploadForm] sessionStorage set OK, check:", check);
    } catch (e) {
      console.error("[UploadForm] sessionStorage.setItem error:", e);
    }

    setError(null);
  }

  function clearFile() {
    console.log("[UploadForm] clearFile");
    setFileName(null);
    setRestoredName(null);
    sessionStorage.removeItem(SESSION_KEY);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    console.log("[UploadForm] handleDrop, file:", file);
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
    console.log("[UploadForm] handleSubmit, file:", file);

    if (!file) {
      if (restoredName) {
        setError(`Wybierz plik ponownie — poprzednio wybrany „${restoredName}" nie jest już dostępny.`);
      } else {
        setError("Wybierz plik CSV lub JSON.");
      }
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("source", "filmweb");

      const res  = await fetch("/api/import/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Błąd importu");

      sessionStorage.removeItem(SESSION_KEY);
      console.log("[UploadForm] Upload OK, redirect to:", data.batchId);

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
        <div className="flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-sm text-amber-300">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">Poprzednio wybrany plik</div>
            <div className="mt-0.5 text-xs text-amber-400/80">
              „{restoredName}" — wybierz go ponownie, aby kontynuować import.
            </div>
          </div>
          <button
            type="button"
            onClick={clearFile}
            className="ml-auto text-amber-400/60 hover:text-amber-300"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <label
        htmlFor="file-upload"
        className={`relative flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center transition ${
          dragging
            ? "border-emerald-400 bg-emerald-400/10"
            : fileName
            ? "border-emerald-400/40 bg-emerald-400/5"
            : restoredName
            ? "border-amber-400/40 bg-amber-400/5 hover:border-amber-400/60"
            : "border-white/15 bg-slate-900/60 hover:border-emerald-400/50"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <UploadCloud
          size={32}
          className={
            fileName
              ? "text-emerald-300"
              : restoredName
              ? "text-amber-400"
              : "text-emerald-300"
          }
        />

        {fileName ? (
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            {fileName}
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); clearFile(); }}
              className="text-slate-500 hover:text-slate-300"
            >
              <X size={14} />
            </button>
          </div>
        ) : restoredName ? (
          <div className="space-y-1">
            <p className="text-sm font-medium text-amber-300">
              Wybierz „{restoredName}" ponownie
            </p>
            <p className="text-xs text-amber-400/70">
              lub przeciągnij inny plik
            </p>
          </div>
        ) : (
          <>
            <span className="text-sm text-slate-300">
              Przeciągnij plik lub kliknij, aby wybrać
            </span>
            <span className="text-xs text-slate-500">
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
          onChange={(e) => {
            console.log("[UploadForm] onChange event, files:", e.target.files);
            handleFile(e.target.files?.[0]);
          }}
        />
      </label>

      {error && (
        <p className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || (!fileReady && !restoredName)}
        className="w-full rounded-lg bg-emerald-400 px-4 py-2.5 font-medium text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50"
      >
        {loading
          ? "Importowanie…"
          : restoredName && !fileName
          ? "Wybierz plik, aby importować"
          : "Importuj plik"}
      </button>
    </form>
  );
}