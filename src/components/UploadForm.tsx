"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { UploadCloud, X } from "lucide-react";

export default function UploadForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function handleFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setError(null);
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
    if (!file) { setError("Wybierz plik CSV lub JSON."); return; }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("source", "filmweb");

      const res  = await fetch("/api/import/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Błąd importu");
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
      {/* Drop zone */}
      <label
        htmlFor="file-upload"
        className={`relative flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center transition ${
          dragging
            ? "border-emerald-400 bg-emerald-400/10"
            : "border-white/15 bg-slate-900/60 hover:border-emerald-400/50"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <UploadCloud size={32} className="text-emerald-300" />
        {fileName ? (
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            {fileName}
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); setFileName(null); if (fileRef.current) fileRef.current.value = ""; }}
              className="text-slate-500 hover:text-slate-300"
            >
              <X size={14} />
            </button>
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
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </label>

      {error && (
        <p className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !fileName}
        className="w-full rounded-lg bg-emerald-400 px-4 py-2.5 font-medium text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50"
      >
        {loading ? "Importowanie…" : "Importuj plik"}
      </button>
    </form>
  );
}
