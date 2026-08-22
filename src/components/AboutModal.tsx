"use client";

//import { X, Github, Film } from "lucide-react";
import { X, Film, GitBranch } from "lucide-react";
import { useEffect } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AboutModal({ open, onClose }: Props) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white"
        >
          <X size={16} />
        </button>

        {/* Logo */}
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400 text-slate-950">
            <Film size={20} />
          </span>
          <div>
            <div className="font-semibold text-white">
              Cine<span className="text-emerald-400">Bridge</span>
            </div>
            <div className="text-xs text-slate-400">wersja 1.0.0</div>
          </div>
        </div>

        <p className="mb-4 text-sm text-slate-400">
          Narzędzie do eksportu historii filmowej z Filmweb do Letterboxd, Simkl,
          Trakt i innych serwisów. Działa lokalnie — Twoje dane nie opuszczają komputera.
        </p>

        <div className="mb-4 space-y-2 rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Autor</span>
            <span className="text-white">Marcin77</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Wersja</span>
            <span className="text-white">1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Licencja</span>
            <span className="text-white">MIT</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Baza danych</span>
            <span className="text-white">SQLite (lokalnie)</span>
          </div>
        </div>

        <a
          href="https://github.com/Marcin77/cinebridge"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white"
        >
          <GitBranch size={15} />
          GitHub — kod źródłowy
        </a>
      </div>
    </div>
  );
}