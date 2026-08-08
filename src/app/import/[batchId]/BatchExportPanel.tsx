"use client";

import { useState } from "react";
import { Download, ChevronDown, ChevronUp, Check } from "lucide-react";

interface Props {
  batchId: number;
  filename: string;
}

const FORMATS = [
  {
    id: "letterboxd",
    label: "Letterboxd CSV",
    desc: "Gotowy import do Letterboxd (Title, Year, WatchedDate, Rating, Review, Tags)",
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

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch(
        `/api/import/${batchId}/export?format=${selectedFormat}`,
      );
      if (!res.ok) throw new Error("Błąd eksportu");
      const blob = await res.blob();
      const contentDisposition = res.headers.get("Content-Disposition") ?? "";
      const match = contentDisposition.match(/filename="?([^"]+)"?/);
      const dlFilename = match?.[1] ?? `cinebridge-${selectedFormat}.csv`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = dlFilename;
      link.click();
      URL.revokeObjectURL(url);
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
          <div className="mb-4 grid gap-2 sm:grid-cols-3">
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
