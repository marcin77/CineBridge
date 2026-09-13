"use client";

import { useState } from "react";
import { Download, ChevronDown, ChevronUp, Check, Loader2, Database, Trash2 } from "lucide-react";

interface Props {
  batchId: number;
  filename: string;
}

const FORMATS = [
  { id: "trakt-zip", label: "CineBridge / Trakt ZIP",
    desc: "Archiwum w formacie eksportu Trakt (JSON). Filmy, seriale, sezony i odcinki z ocenami, obejrzane, watchlista, listy. Akceptowany wszędzie, gdzie można wgrać backup Trakt (trakt.tv, bingebase, simkl…).",
    badge: "Zalecany", badgeColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-300" },
  { id: "letterboxd", label: "Letterboxd ZIP",
    desc: "Archiwum ZIP: watched.csv, watchlist.csv i osobne pliki dla list. Tylko filmy — seriale pomijane.",
    badge: "Popularny", badgeColor: "bg-sky-100 text-sky-700 dark:bg-sky-400/20 dark:text-sky-300" },
  { id: "universal", label: "CineBridge / Uniwersalny CSV",
    desc: "Pełny zrzut wszystkich pól (w tym sezony i odcinki, komentarze, listy, ID). Backup i dalsze przetwarzanie; do importu w serwisach użyj Trakt ZIP.",
    badge: "Pełny backup", badgeColor: "bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-300" },
  { id: "simkl", label: "Simkl CSV",
    desc: "Format CSV importu Simkl (Type, IMDB_ID, Title, Watchlist, WatchedDate, Rating).",
    badge: "Alternatywa", badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-400/20 dark:text-blue-300" },
  { id: "trakt", label: "Trakt CSV",
    desc: "Prosty CSV do ręcznego importu przez formularz trakt.tv (bez odcinków).",
    badge: "Opcjonalny", badgeColor: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-400/20 dark:text-fuchsia-300" },
] as const;

type FormatId = (typeof FORMATS)[number]["id"];

// ── Stan dopasowania TMDB ─────────────────────────────────────────────────────
interface MatchStats {
  matched: number;
  failed: number;
  remaining: number;
  total: number;       // łączna liczba do dopasowania (ustalona na starcie)
}

export default function BatchExportPanel({ batchId, filename }: Props) {
  const [selectedFormat, setSelectedFormat] = useState<FormatId>("trakt-zip");
  const [open, setOpen] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [matching, setMatching] = useState(false);
  const [matchStats, setMatchStats] = useState<MatchStats | null>(null);
  const [matchDone, setMatchDone]         = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [cacheCleared, setCacheCleared]   = useState(false); 
  const [matchError, setMatchError] = useState<string | null>(null);

  async function handleTmdbMatch() {
    setMatching(true);
    setMatchStats(null);
    setMatchDone(false);
    setMatchError(null);

    // Sumy skumulowane przez cały przebieg
    let totalMatched = 0;
    let totalFailed  = 0;
    let total        = 0;   // ustalimy po pierwszym chunku

    try {
      let remaining = 1;

      while (remaining > 0) {
        const res  = await fetch(`/api/import/${batchId}/tmdb-match`, { method: "POST" });
        const data = await res.json();

        if (!res.ok) {
          setMatchError(data.error ?? "Błąd dopasowywania");
          break;
        }

        totalMatched += data.matched;
        totalFailed  += data.failed;
        remaining     = data.remaining;

        // Przy pierwszym chunku ustal łączną liczbę do dopasowania
        if (total === 0) {
          total = totalMatched + totalFailed + remaining;
        }

        setMatchStats({ matched: totalMatched, failed: totalFailed, remaining, total });

        // Zatrzymaj jeśli nic nie ma do przetworzenia
        if (data.matched === 0 && data.failed === 0) break;
        if (remaining > 0) await new Promise(r => setTimeout(r, 300));
      }

      setMatchDone(true);
    } catch {
      setMatchError("Błąd połączenia");
    } finally {
      setMatching(false);
    }
  }

  // Procent ukończenia
  const matchPercent = matchStats
    ? Math.round(((matchStats.matched + matchStats.failed) / Math.max(matchStats.total, 1)) * 100)
    : 0;

    async function handleClearTmdbCache() {
  if (!confirm("Wyczyścić cache dopasowań TMDB? Wszystkie tytuły zostaną wyszukane ponownie przy następnym dopasowaniu.")) return;
  setClearingCache(true);
  setCacheCleared(false);
  try {
    const res = await fetch("/api/tmdb-cache", { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      setCacheCleared(true);
      setMatchStats(null);
      setMatchDone(false);
    } else {
      setMatchError(data.error ?? "Błąd czyszczenia cache");
    }
  } catch {
    setMatchError("Błąd połączenia");
  } finally {
    setClearingCache(false);
  }
}
  async function handleDownload() {
    setDownloading(true);
    try {
      const url =
        selectedFormat === "letterboxd" ? `/api/import/${batchId}/export/letterboxd-zip` :
        selectedFormat === "trakt-zip"  ? `/api/import/${batchId}/export/trakt-zip` :
        `/api/import/${batchId}/export?format=${selectedFormat}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("Błąd eksportu");
      const blob = await res.blob();

      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename="?([^"]+)"?/);
      const dlFilename =
        match?.[1] ??
        (selectedFormat === "letterboxd"
          ? `cinebridge-letterboxd-${filename.replace(/\.[^.]+$/, "")}.zip`
          : `cinebridge-${selectedFormat}.${selectedFormat.endsWith("zip") ? "zip" : "csv"}`);

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = dlFilename;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Błąd pobierania");
    } finally {
      setDownloading(false);
    }
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
        <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
  {FORMATS.map((fmt) => (
    <button key={fmt.id} onClick={() => setSelectedFormat(fmt.id)}
      className={`relative flex h-full flex-col rounded-xl border p-4 text-left transition ${
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

          {/* ── TMDB matching ─────────────────────────────────────────────── */}
          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-900/40">
            <div className="mb-2 flex items-center gap-2">
              <Database size={14} className="text-sky-500 dark:text-sky-400" />
              <span className="text-sm font-medium text-slate-900 dark:text-white">Uzupełnij ID przez TMDB</span>
              <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] text-sky-700 dark:bg-sky-400/20 dark:text-sky-300">
                Zalecane przed eksportem
              </span>
            </div>
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              Automatycznie wyszukuje brakujące IMDB ID i TMDB ID — znacznie poprawia wykrywalność.
              Wymaga klucza TMDB API w{" "}
              <a href="/settings" className="text-emerald-600 hover:underline dark:text-emerald-300">Ustawieniach</a>.
            </p>

            {/* Błąd */}
            {matchError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-400/20 dark:bg-red-400/5 dark:text-red-300">
                {matchError}
              </div>
            )}

            {/* Pasek postępu + statystyki */}
            {matchStats && (
              <div className="mb-3 space-y-2">
                {/* Pasek */}
                <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-sky-500 transition-all duration-300 dark:bg-sky-400"
                    style={{ width: `${matchPercent}%` }}
                  />
                </div>

                {/* Liczniki */}
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    {matchDone ? (
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">
                        ✓ Zakończono
                      </span>
                    ) : (
                      <span>Przetwarzanie…</span>
                    )}
                  </span>
                  <span>{matchPercent}%</span>
                </div>

                {/* Sumy skumulowane */}
                <div className="flex gap-4 text-xs">
                  <span className="text-emerald-600 dark:text-emerald-400">
                    ✓ Dopasowano: <strong>{matchStats.matched}</strong>
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">
                    ✗ Nie znaleziono: <strong>{matchStats.failed}</strong>
                  </span>
                  {!matchDone && (
                    <span className="text-slate-400 dark:text-slate-500">
                      Pozostało: <strong>{matchStats.remaining}</strong>
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Przycisk — tylko jeden */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleTmdbMatch}
                disabled={matching || clearingCache}
                className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-medium text-sky-700 transition hover:bg-sky-100 disabled:opacity-50 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-300 dark:hover:bg-sky-400/20"
              >
                {matching
                  ? <Loader2 size={12} className="animate-spin" />
                  : <Database size={12} />}
                {matching ? "Dopasowywanie…" : matchDone ? "Dopasuj ponownie" : "Dopasuj wszystkie"}
              </button>

              <button
                onClick={handleClearTmdbCache}
                disabled={matching || clearingCache}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10"
                title="Usuwa zapisane wyniki wyszukiwania TMDB — tytuły zostaną wyszukane ponownie"
              >
                {clearingCache
                  ? <Loader2 size={12} className="animate-spin" />
                  : <Trash2 size={12} />}
                {clearingCache ? "Czyszczenie…" : "Wyczyść cache"}
              </button>
            </div>

            {cacheCleared && (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                ✓ Cache wyczyszczony — kliknij „Dopasuj wszystkie" aby wyszukać ponownie.
              </p>
            )}
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