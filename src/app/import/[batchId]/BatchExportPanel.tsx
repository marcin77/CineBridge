"use client";

import { useState } from "react";
//import { Download, ChevronDown, ChevronUp, Check } from "lucide-react";
import { Download, ChevronDown, ChevronUp, Check, Loader2, Database } from "lucide-react";

interface Props {
  batchId: number;
  filename: string;
}

const FORMATS = [
  {
    id: "letterboxd",
    label: "Letterboxd ZIP",
    desc: "Archiwum ZIP z osobnymi plikami: watched.csv, watchlist.csv i osobne pliki dla każdej listy. Tylko filmy — seriale pomijane.",
    badge: "Popularny",
    badgeColor: "bg-emerald-400/20 text-emerald-300",
  },
  {
    id: "universal",
    label: "CineBridge / Universalny CSV",
    desc: "Pełny eksport ze wszystkimi polami. Idealny do archiwizacji i dalszego przetwarzania.",
    badge: "Zalecany",
    badgeColor: "bg-sky-400/20 text-sky-300",
  },
  {
    id: "simkl",
    label: "Simkl CSV",
    desc: "Format CSV importu Simkl (Type, IMDB_ID, Title, Watchlist, WatchedDate, Rating)",
    badge: "Nowy",
    badgeColor: "bg-blue-400/20 text-blue-300",
  },
  {
    id: "trakt",
    label: "Trakt CSV",
    desc: "Format CSV importu Trakt (opcjonalne – do ręcznego importu przez formularz trakt.tv)",
    badge: "Opcjonalny",
    badgeColor: "bg-fuchsia-400/20 text-fuchsia-300",
  },
] as const;

type FormatId = (typeof FORMATS)[number]["id"];

export default function BatchExportPanel({ batchId, filename }: Props) {
  const [selectedFormat, setSelectedFormat] = useState<FormatId>("letterboxd");
  const [open, setOpen] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [matching, setMatching]       = useState(false);
  const [matchResult, setMatchResult] = useState<{ matched: number; failed: number; remaining: number } | null>(null);
  const [matchError, setMatchError]   = useState<string | null>(null);

  async function handleTmdbMatch(all = false) {
    setMatching(true);
    setMatchResult(null);
    setMatchError(null);

    try {
      let remaining = 1;

      while (remaining > 0) {
        const res  = await fetch(`/api/import/${batchId}/tmdb-match`, { method: "POST" });
        const data = await res.json();

        if (!res.ok) {
          setMatchError(data.error ?? "Błąd dopasowywania");
          break;
        }

        remaining = data.remaining;

        // Pokazuj wyniki ostatniego chunku + ile pozostało
        setMatchResult({
          matched:   data.matched,
          failed:    data.failed,
          remaining: data.remaining,
        });

        if (!all) break;

        // Jeśli chunk nie przetworzył nic — zatrzymaj (brak postępu)
        if (data.matched === 0 && data.failed === 0) break;

        if (remaining > 0) await new Promise(r => setTimeout(r, 500));
      }
    } catch {
      setMatchError("Błąd połączenia");
    } finally {
      setMatching(false);
    }
  }
  
  async function handleDownload() {
  setDownloading(true);
  try {
    let url: string;
    let dlFilename: string;

    if (selectedFormat === "letterboxd") {
      // Letterboxd — pobierz ZIP z osobnymi plikami
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
      // Pozostałe formaty — zwykły CSV
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
  } catch (err) {
    alert(err instanceof Error ? err.message : "Błąd pobierania");
  } finally {
    setDownloading(false);
  }
}

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5">
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <Download size={16} className="text-emerald-400" />
          <span className="font-semibold text-white">Eksportuj dane</span>
        </div>
        {open ? (
          <ChevronUp size={16} className="text-slate-400" />
        ) : (
          <ChevronDown size={16} className="text-slate-400" />
        )}
      </button>

      {open && (
        <div className="border-t border-white/10 p-5">
          <p className="mb-4 text-sm text-slate-400">
            Wybierz format eksportu. Plik zawiera wszystkie zaimportowane pozycje wraz z
            ocenami, datami, komentarzami i listami.
          </p>

          {/* Format selector */}
          <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {FORMATS.map((fmt) => (
              <button
                key={fmt.id}
                onClick={() => setSelectedFormat(fmt.id)}
                className={`relative rounded-xl border p-4 text-left transition ${
                  selectedFormat === fmt.id
                    ? "border-emerald-400/50 bg-emerald-400/10"
                    : "border-white/10 bg-slate-900/40 hover:border-white/20"
                }`}
              >
                {selectedFormat === fmt.id && (
                  <span className="absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400 text-slate-950">
                    <Check size={10} />
                  </span>
                )}
                <div className="mb-1.5">
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${fmt.badgeColor}`}>
                    {fmt.badge}
                  </span>
                </div>
                <div className="text-sm font-medium text-white">{fmt.label}</div>
                <div className="mt-1 text-xs leading-relaxed text-slate-400">{fmt.desc}</div>
              </button>
            ))}
          </div>

          {/* TMDB Matching */}
          <div className="mb-4 rounded-xl border border-white/10 bg-slate-900/40 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Database size={14} className="text-sky-400" />
              <span className="text-sm font-medium text-white">Uzupełnij ID przez TMDB</span>
              <span className="rounded-full bg-sky-400/20 px-1.5 py-0.5 text-[10px] text-sky-300">Zalecane przed Simkl</span>
            </div>
            <p className="mb-3 text-xs text-slate-400">
              Automatycznie wyszukuje brakujące IMDB ID i TMDB ID — znacznie poprawia wykrywalność w Simkl.
              Wymaga klucza TMDB API w{" "}
              <a href="/settings" className="text-emerald-300 hover:underline">Ustawieniach</a>.
            </p>

            {matchError && (
              <div className="mb-2 rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2 text-xs text-red-300">
                {matchError}
              </div>
            )}
            {matchResult && (
              <div className="mb-2 rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-xs text-emerald-300">
                {matchResult.remaining === 0
                  ? `✓ Zakończono! Dopasowano: ${matchResult.matched} · Nie znaleziono w TMDB: ${matchResult.failed}`
                  : `Dopasowano: ${matchResult.matched} · Nie znaleziono: ${matchResult.failed} · Pozostało: ${matchResult.remaining}`
                }
              </div>
            )}

              <div className="flex gap-2">
                <button
                  onClick={() => handleTmdbMatch(false)}
                  disabled={matching}
                  className="flex items-center gap-2 rounded-lg border border-sky-400/30 bg-sky-400/10 px-4 py-2 text-xs font-medium text-sky-300 transition hover:bg-sky-400/20 disabled:opacity-50"
                >
                  {matching ? <Loader2 size={12} className="animate-spin" /> : <Database size={12} />}
                  {matching ? "Dopasowywanie…" : "Dopasuj 20 pozycji"}
                </button>

                <button
                  onClick={() => handleTmdbMatch(true)}
                  disabled={matching}
                  className="flex items-center gap-2 rounded-lg border border-sky-400/30 bg-sky-400/10 px-4 py-2 text-xs font-medium text-sky-300 transition hover:bg-sky-400/20 disabled:opacity-50"
                >
                  {matching ? <Loader2 size={12} className="animate-spin" /> : <Database size={12} />}
                  Dopasuj wszystkie
                </button>
              </div>
          </div>

          {/* Trakt note */}
          {selectedFormat === "trakt" && (
            <div className="mb-4 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-300">
              <strong>Uwaga o Trakt:</strong> Trakt ograniczył liczbę aplikacji podpiętych przez API do 1 na
              konto. Eksport CSV możesz zaimportować ręcznie przez stronę trakt.tv → Ustawienia → Import.
            </div>
          )}

          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-2.5 font-medium text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50"
          >
            <Download size={16} />
            {downloading ? "Pobieranie…" : `Pobierz ${FORMATS.find((f) => f.id === selectedFormat)?.label}`}
          </button>
        </div>
      )}
    </div>
  );
}
