"use client";

import { X, Film, GitBranch, Coffee, Heart, RefreshCw, Info } from "lucide-react";
import { useEffect } from "react";
import type { UpdaterStatus } from "@/hooks/use-updater";

interface Props {
  open: boolean;
  onClose: () => void;
  status: UpdaterStatus;
  updateVersion: string | null;
  checkError: string | null;
  onCheck: () => void;
  onShowUpdate: () => void;
}

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

const DONATION_LINKS = [
  { label: "GitHub Sponsors", href: "https://github.com/sponsors/marcin77", icon: Heart },
  { label: "Buy Me a Coffee", href: "https://www.buymeacoffee.com/marcin77", icon: Coffee },
  { label: "Ko-fi", href: "https://ko-fi.com/marcin77", icon: Coffee },
  { label: "PayPal", href: "https://paypal.me/MartinSnow", icon: Heart },
];

export default function AboutModal({
  open,
  onClose,
  status,
  updateVersion,
  checkError,
  onCheck,
  onShowUpdate,
}: Props) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const busy = status === "checking" || status === "downloading";
  let statusText = "";
  if (status === "checking") statusText = "Sprawdzanie…";
  else if (status === "available") statusText = `Dostępna wersja ${updateVersion}`;
  else if (status === "downloading") statusText = "Pobieranie aktualizacji…";
  else if (status === "downloaded") statusText = `Wersja ${updateVersion} gotowa do instalacji`;
  else if (checkError) statusText = checkError;
  else if (status === "not-available") statusText = "Masz najnowszą wersję";

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-white"
        >
          <X size={16} />
        </button>

        {/* Logo */}
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400 text-slate-950">
            <Film size={20} />
          </span>
          <div>
            <div className="font-semibold text-slate-900 dark:text-white">
              Cine<span className="text-emerald-500 dark:text-emerald-400">Bridge</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              wersja {APP_VERSION}
              <a
                href="https://github.com/marcin77/CineBridge/releases"
                target="_blank"
                rel="noopener noreferrer"
                title="Lista zmian"
                className="text-slate-400 hover:text-emerald-500"
              >
                <Info size={13} />
              </a>
            </div>
          </div>
        </div>

        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          Narzędzie do eksportu historii filmowej z Filmweb do Letterboxd, Simkl,
          Trakt i innych serwisów. Działa lokalnie — Twoje dane nie opuszczają komputera.
        </p>

        <div className="mb-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-white/10 dark:bg-white/5">
          {[
            { label: "Autor",       value: "Marcin77" },
            { label: "Wersja",      value: APP_VERSION },
            { label: "Licencja",    value: "MIT" },
            { label: "Baza danych", value: "SQLite (lokalnie)" },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">{label}</span>
              <span className="text-slate-900 dark:text-white">{value}</span>
            </div>
          ))}
        </div>

        {/* Aktualizacje */}
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-xs dark:border-white/10">
          <div className="min-w-0 text-slate-500 dark:text-slate-400">
            <span className={checkError && status === "idle" ? "text-red-500" : ""}>
              {statusText}
            </span>
            {(status === "available" || status === "downloaded") && (
              <button
                onClick={onShowUpdate}
                className="ml-2 underline underline-offset-2 text-emerald-600 dark:text-emerald-400"
              >
                Co nowego
              </button>
            )}
          </div>
          <button
            onClick={onCheck}
            disabled={busy}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
          >
            <RefreshCw size={12} className={status === "checking" ? "animate-spin" : ""} />
            Sprawdź aktualizacje
          </button>
        </div>

        <a
          href="https://github.com/Marcin77/cinebridge"
          target="_blank"
          rel="noopener noreferrer"
          className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
        >
          <GitBranch size={15} />
          GitHub — kod źródłowy
        </a>

        {/* Wesprzyj projekt */}
        <div className="border-t border-slate-200 pt-4 dark:border-white/10">
          <div className="mb-3 text-center text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Podoba Ci się CineBridge?
          </div>
          <div className="grid grid-cols-2 gap-2">
            {DONATION_LINKS.map(({ label, href, icon: Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:border-white/10 dark:text-slate-300 dark:hover:border-emerald-400/30 dark:hover:bg-emerald-400/10 dark:hover:text-emerald-300"
              >
                <Icon size={13} />
                {label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}