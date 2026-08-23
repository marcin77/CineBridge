"use client";

import { useState } from "react";
import { Copy, Check, Download, ExternalLink, AlertTriangle, Info, ChevronRight, Code2 } from "lucide-react";

interface Props {
  scriptContent: string;
}

export default function ScraperClient({ scriptContent }: Props) {
  const [copied, setCopied] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(scriptContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  }

  function handleDownload() {
    const blob = new Blob([scriptContent], { type: "text/javascript;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "filmweb-scraper.js";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700 dark:bg-sky-400/10 dark:text-sky-300">
          <Code2 size={13} /> Skrypt do konsoli przeglądarki
        </div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Scraper Filmweb</h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          Uruchamiany bezpośrednio w przeglądarce — nie wymaga instalacji, nie potrzebuje dostępu
          do serwera. Wszystko dzieje się lokalnie na Twoim koncie Filmweb.
        </p>
      </div>

      {/* Banner zachęcający do desktop */}
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-400/20 dark:bg-emerald-400/5">
        <Download size={18} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
        <div>
          <div className="mb-1 font-medium text-emerald-700 dark:text-emerald-300">
            💡 Zalecane: Pobierz wersję desktop
          </div>
          <p className="text-sm text-emerald-600 dark:text-emerald-400/80">
            Aplikacja desktopowa CineBridge oferuje <strong>pełną automatyzację</strong> —
            automatyczne logowanie, obsługę captcha, pobieranie ulubionych i list użytkownika,
            oraz bezpośredni import do bazy bez ręcznego wgrywania plików CSV.
          </p>
          <a
            href="https://github.com/your-username/cinebridge/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-300"
          >
            <Download size={14} />
            Pobierz CineBridge Desktop (darmowe)
          </a>
        </div>
      </div>

      {/* Instructions */}
      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
        <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">Jak uruchomić scraper?</h2>
        <ol className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
          {[
            <>Otwórz <a href="https://www.filmweb.pl" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-emerald-600 hover:underline dark:text-emerald-300">
              filmweb.pl <ExternalLink size={12} /></a>{" "}
              i upewnij się, że jesteś <strong className="text-slate-900 dark:text-white">zalogowany</strong> na swoje konto.
            </>,
            <>Naciśnij <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-900 dark:bg-white/10 dark:text-white">F12</kbd>{" "}
              (lub <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-900 dark:bg-white/10 dark:text-white">Ctrl+Shift+J</kbd>) aby otworzyć{" "}
              <strong className="text-slate-900 dark:text-white">DevTools → Console</strong>.
            </>,
            <>Skopiuj cały skrypt poniżej (przycisk <strong className="text-slate-900 dark:text-white">Kopiuj skrypt</strong>)
              i wklej go w konsoli, następnie naciśnij{" "}
              <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-900 dark:bg-white/10 dark:text-white">Enter</kbd>.
            </>,
            <>Skrypt automatycznie pobierze Twoje dane (oceny, komentarze, listy) i ściągnie plik{" "}
              <code className="rounded bg-slate-100 px-1 text-xs text-slate-900 dark:bg-white/10 dark:text-white">filmweb_export_YYYY-MM-DD.csv</code>.
            </>,
            <><strong className="text-slate-900 dark:text-white">Wgraj pobrany plik</strong> na stronie{" "}
              <a href="/import" className="text-emerald-600 hover:underline dark:text-emerald-300">Import</a>{" "}
              i pobierz eksport dla wybranego serwisu.
            </>,
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-700 mt-0.5 dark:bg-emerald-400/20 dark:text-emerald-300">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Warning */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <strong className="text-amber-900 dark:text-amber-300">Uwaga:</strong> Skrypt działa bezpośrednio w Twojej
          przeglądarce i pobiera dane tylko z Twojego konta. Nigdy nie wklejaj skryptów
          z nieznanych źródeł w konsolę przeglądarki.
        </div>
      </div>

      {/* Info */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:border-sky-400/20 dark:bg-sky-400/5 dark:text-sky-200">
        <Info size={16} className="mt-0.5 shrink-0 text-sky-600 dark:text-sky-400" />
        <div>
          Skrypt jest w <strong className="text-sky-900 dark:text-sky-300">jednym pliku</strong> z wyraźnie wyodrębnioną
          sekcją <code className="rounded bg-white px-1 text-xs text-slate-900 dark:bg-white/10 dark:text-white">FILMWEB_CONFIG</code>.
          Jeśli Filmweb zmieni strukturę swojego API, wystarczy zaktualizować URLe i nazwy pól
          w tej sekcji — reszta logiki pozostaje bez zmian.
        </div>
      </div>

      {/* Script display */}
      <section className="rounded-2xl border border-slate-200 bg-slate-50 shadow-sm dark:border-white/10 dark:bg-slate-900/80 dark:shadow-none">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-white/10">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Code2 size={14} />
            <span>filmweb-scraper.js</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600 dark:bg-white/10 dark:text-slate-300">
              {scriptContent.split("\n").length} linii
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowRaw(!showRaw)}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white">
              <ChevronRight size={12} className={`transition ${showRaw ? "rotate-90" : ""}`} />
              {showRaw ? "Zwiń" : "Rozwiń"}
            </button>
            <button onClick={handleDownload}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white">
              <Download size={12} />
              Pobierz .js
            </button>
            <button onClick={handleCopy}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                copied ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-300"
                      : "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
              }`}>
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Skopiowano!" : "Kopiuj skrypt"}
            </button>
          </div>
        </div>

        {showRaw && (
          <div className="relative max-h-[60vh] overflow-auto">
            <pre className="p-4 text-xs leading-relaxed text-slate-700 font-mono whitespace-pre dark:text-slate-300">
              {scriptContent}
            </pre>
          </div>
        )}

        {!showRaw && (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-slate-500">
              Kliknij <strong className="text-slate-700 dark:text-slate-300">Kopiuj skrypt</strong> aby skopiować do schowka,
              lub <strong className="text-slate-700 dark:text-slate-300">Rozwiń</strong> aby podejrzeć kod.
            </p>
          </div>
        )}
      </section>

      {/* Supported data */}
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
        <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">Co zbiera skrypt?</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { title: "✅ Oceny filmów",        desc: "Wszystkie filmy ocenione w skali 1–10 z datą oceny." },
            { title: "✅ Oceny seriali",       desc: "Wszystkie seriale ocenione z datą oceny." },
            { title: "✅ Komentarze",          desc: "Recenzje i komentarze dołączone do ocen." },
            { title: "✅ Lista „Chcę zobaczyć\"", desc: "Watchlist filmów i seriali." },
            { title: "✅ Ulubione",            desc: "Filmy i seriale oznaczone jako ulubione." },
            { title: "⚡ Daty obejrzenia",     desc: "Gdy dostępne — data pierwszego obejrzenia." },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-slate-900/40">
              <div className="text-sm font-medium text-slate-900 dark:text-white">{item.title}</div>
              <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{item.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Compatibility */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
        <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">Obsługiwane formaty importu</h2>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          CineBridge akceptuje pliki z tego scrapera, ale też z innych popularnych narzędzi:
        </p>
        <ul className="space-y-2 text-sm">
          {[
            { name: "CineBridge Scraper (ten skrypt)", fmt: "filmweb_export_YYYY-MM-DD.csv", badge: "Zalecane", badgeColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-300" },
            { name: "filmweb-export (Python)", fmt: "CSV / JSON", badge: "Obsługiwane", badgeColor: "bg-sky-100 text-sky-700 dark:bg-sky-400/20 dark:text-sky-300", url: "https://github.com/ppatrzyk/filmweb-export" },
            { name: "Filmweb2Letterboxd", fmt: "CSV (format Letterboxd)", badge: "Obsługiwane", badgeColor: "bg-sky-100 text-sky-700 dark:bg-sky-400/20 dark:text-sky-300", url: "https://github.com/JSerwatka/Filmweb2Letterboxd" },
            { name: "Własny plik CSV", fmt: "Kolumny: title, year, user_rating, watched_at, comment…", badge: "Elastyczne", badgeColor: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-400/20 dark:text-fuchsia-300" },
          ].map((item) => (
            <li key={item.name} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-slate-900/40">
              <div>
                <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-white">
                  {item.name}
                  {item.url && (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{item.fmt}</div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${item.badgeColor}`}>
                {item.badge}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
