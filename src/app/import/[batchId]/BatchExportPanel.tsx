"use client";

import { useState } from "react";
import { Download, ChevronDown, ChevronUp, Check, Loader2, Database } from "lucide-react";

interface Props {
  batchId: number;
  filename: string;
}

const FORMATS = [
  { id: "letterboxd", label: "Letterboxd ZIP", desc: "Archiwum ZIP z osobnymi plikami: watched.csv, watchlist.csv i osobne pliki dla każdej listy. Tylko filmy — seriale pomijane.", badge: "Popularny", badgeColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-300" },
  { id: "universal", label: "CineBridge / Universalny CSV", desc: "Pełny eksport ze wszystkimi polami. Idealny do archiwizacji i dalszego przetwarzania.", badge: "Zalecany", badgeColor: "bg-sky-100 text-sky-700 dark:bg-sky-400/20 dark:text-sky-300" },
  { id: "simkl", label: "Simkl CSV", desc: "Format CSV importu Simkl (Type, IMDB_ID, Title, Watchlist, WatchedDate, Rating)", badge: "Nowy", badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-400/20 dark:text-blue-300" },
  { id: "trakt", label: "Trakt CSV", desc: "Format CSV importu Trakt (opcjonalne – do ręcznego importu przez formularz trakt.tv)", badge: "Opcjonalny", badgeColor: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-400/20 dark:text-fuchsia-300" },
] as const;

type FormatId = (typeof FORMATS)[number]["id"];

export default function BatchExportPanel({ batchId, filename }: Props) {
  const [selectedFormat, setSelectedFormat] = useState<FormatId>("letterboxd");
  const [open, setOpen] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [matching, setMatching] = useState(false);
  const [matchResult, setMatchResult] = useState<{ matched: number; failed: number; remaining: number } | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);

  async function handleTmdbMatch(all = false) {
    setMatching(true);
    setMatchResult(null);
    setMatchError(null);
    try {
      let remaining = 1;
      while (remaining > 0) {
        const res = await fetch(`/api/import/${batchId}/tmdb-match`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) { setMatchError(data.error ?? "Błąd dopasowywania"); break; }
        remaining = data.remaining;
        setMatchResult({ matched: data.matched, failed: data.failed, remaining: data.remaining });
        if (!all) break;
        if (data.matched === 0 && data.failed === 0) break;
        if (remaining > 0) await new Promise(r => setTimeout(r, 500));
      }
    } catch { setMatchError("Błąd połączenia"); }
    finally { setMatching(false); }
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      let url: string;
      let dlFilename: string;
      if (selectedFormat === "letterboxd") {
        url = `/api/import/${batchId}/export/letterboxd-zip`;
        dlFilename = `cinebridge-letterboxd-${filename.replace(/\.[^.]+$/, "")}.zip`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Błąd eksportu");
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = dlFilename;
        link.click();
        URL.revokeObjectURL(objectUrl);
      } else {
        const res = await fetch(`/api/import/${batchId}/export?format=${selectedFormat}`);
        if (!res.ok) throw new Error("Błąd eksportu");
        const blob = await res.blob();
        const contentDisposition = res.headers.get("Content-Disposition") ?? "";
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        dlFilename = match?.[1] ?? `cinebridge-${selectedFormat}.csv`;
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = dlFilename;
        link.click();
        URL.revokeObjectURL(objectUrl);
      }
    } catch (err) { alert(err instanceof Error ? err.message : "Błąd pobierania"); }
    finally { setDownloading(false); }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-5 py-4 text-left">
        <div className="flex items-center gap-2">
          <Download size={16} className="text-emerald-500 dark:text-emerald-400" />
          <span className="font-semibold text-slate-900 dark:text-white">Eksportuj dane</span>
        </div>
        {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>

      {open && (
        <div className="border-t border-slate-200 p-5 dark:border-white/10">
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            Wybierz format eksportu. Plik zawiera wszystkie zaimportowane pozycje wraz z ocenami, datami, komentarzami i listami.
          </p>

          <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {FORMATS.map((fmt) => (
              <button key={fmt.id} onClick={() => setSelectedFormat(fmt.id)}
                className={`relative rounded-xl border p-4 text-left transition ${
                  selectedFormat === fmt.id
                    ? "border-emerald-300 bg-emerald-50 dark:border-emerald-400/50 dark:bg-emerald-400/10"
                    : "border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-white/10 dark:bg-slate-900/40 dark:hover:border-white/20"
                }`}>
                {selectedFormat === fmt.id && (
                  <span className="absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white dark:bg-emerald-400 dark:text-slate-950">
                    <Check size={10} />
                  </span>
                )}
                <div className="mb-1.5">
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${fmt.badgeColor}`}>
                    {fmt.badge}
                  </span>
                </div>
                <div className="text-sm font-medium text-slate-900 dark:text-white">{fmt.label}</div>
                <div className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{fmt.desc}</div>
              </button>
            ))}
          </div>

          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-900/40">
            <div className="mb-2 flex items-center gap-2">
              <Database size={14} className="text-sky-500 dark:text-sky-400" />
              <span className="text-sm font-medium text-slate-900 dark:text-white">Uzupełnij ID przez TMDB</span>
              <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] text-sky-700 dark:bg-sky-400/20 dark:text-sky-300">Zalecane przed Simkl</span>
            </div>
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              Automatycznie wyszukuje brakujące IMDB ID i TMDB ID — znacznie poprawia wykrywalność w Simkl.
              Wymaga klucza TMDB API w <a href="/settings" className="text-emerald-600 hover:underline dark:text-emerald-300">Ustawieniach</a>.
            </p>

            {matchError && (
              <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-400/20 dark:bg-red-400/5 dark:text-red-300">
                {matchError}
              </div>
            )}
            {matchResult && (
              <div className="mb-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/5 dark:text-emerald-300">
                {matchResult.remaining === 0
                  ? `✓ Zakończono! Dopasowano: ${matchResult.matched} · Nie znaleziono w TMDB: ${matchResult.failed}`
                  : `Dopasowano: ${matchResult.matched} · Nie znaleziono: ${matchResult.failed} · Pozostało: ${matchResult.remaining}`}
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => handleTmdbMatch(false)} disabled={matching}
                className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-medium text-sky-700 transition hover:bg-sky-100 disabled:opacity-50 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-300 dark:hover:bg-sky-400/20">
                {matching ? <Loader2 size={12} className="animate-spin" /> : <Database size={12} />}
                {matching ? "Dopasowywanie…" : "Dopasuj 20 pozycji"}
              </button>
              <button onClick={() => handleTmdbMatch(true)} disabled={matching}
                className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-medium text-sky-700 transition hover:bg-sky-100 disabled:opacity-50 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-300 dark:hover:bg-sky-400/20">
                {matching ? <Loader2 size={12} className="animate-spin" /> : <Database size={12} />}
                Dopasuj wszystkie
              </button>
            </div>
          </div>

          {selectedFormat === "trakt" && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/5 dark:text-amber-300">
              <strong>Uwaga o Trakt:</strong> Trakt ograniczył liczbę aplikacji podpiętych przez API do 1 na
              konto. Eksport CSV możesz zaimportować ręcznie przez stronę trakt.tv → Ustawienia → Import.
            </div>
          )}

          <button onClick={handleDownload} disabled={downloading}
            className="flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-2.5 font-medium text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50">
            <Download size={16} />
            {downloading ? "Pobieranie…" : `Pobierz ${FORMATS.find((f) => f.id === selectedFormat)?.label}`}
          </button>
        </div>
      )}
    </div>
  );
}
