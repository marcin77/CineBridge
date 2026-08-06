"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";

const CATEGORIES = [
  { value: "watched", label: "Obejrzane / Oceny" },
  { value: "watchlist", label: "Chcę zobaczyć (watchlist)" },
  { value: "favorite", label: "Ulubione" },
];

export default function UploadForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState("watched");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Wybierz plik CSV lub JSON.");
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category);
      formData.append("source", "filmweb");

      const res = await fetch("/api/import/upload", { method: "POST", body: formData });
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
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">
          Kategoria danych w pliku
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <label
        htmlFor="file-upload"
        className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-white/15 bg-slate-900/60 px-4 py-10 text-center transition hover:border-emerald-400/50"
      >
        <UploadCloud size={28} className="text-emerald-300" />
        <span className="text-sm text-slate-300">
          {fileName ?? "Kliknij, aby wybrać plik CSV lub JSON z Filmweb"}
        </span>
        <span className="text-xs text-slate-500">Obsługiwane: filmweb-export, Filmweb2Letterboxd, format uniwersalny</span>
        <input
          id="file-upload"
          ref={fileRef}
          type="file"
          accept=".csv,.json,text/csv,application/json"
          className="hidden"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-emerald-400 px-4 py-2.5 font-medium text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50"
      >
        {loading ? "Importowanie…" : "Importuj plik"}
      </button>
    </form>
  );
}
