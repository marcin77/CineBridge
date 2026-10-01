"use client";

import { useState, useEffect } from "react";
import { Key, Check, X, Loader2, ExternalLink, Eye, EyeOff, LogIn, Trash2 } from "lucide-react";

interface Props {
  hasApiKey: boolean;
}

export default function SettingsForm({ hasApiKey }: Props) {
  const [apiKey, setApiKey]         = useState("");
  const [saving, setSaving]         = useState(false);
  const [testing, setTesting]       = useState(false);
  const [saved, setSaved]           = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "error" | null>(null);
  const [keySet, setKeySet]         = useState(hasApiKey);

  // Filmweb credentials
  const [isElectron] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return !!(window as any).electronAPI;
  });
  const [fwEmail, setFwEmail]           = useState("");
  const [fwPassword, setFwPassword]     = useState("");
  const [fwSaved, setFwSaved]           = useState(false);
  const [fwCredsSaved, setFwCredsSaved] = useState(false);
  const [showPass, setShowPass]         = useState(false);
  const [fwSaving, setFwSaving]         = useState(false);
  const [fwClearing, setFwClearing]     = useState(false);

  useEffect(() => {
    if (!isElectron) return;
    const api = (window as any).electronAPI;
    api.loadCredentials().then(
      (creds: { email: string; password: string } | null) => {
        if (creds) {
          setFwEmail(creds.email);
          setFwPassword(creds.password);
          setFwCredsSaved(true);
        }
      },
    );
  }, [isElectron]);

  // ── TMDB handlers ──────────────────────────────────────────────────────────

  async function handleSave() {
    if (!apiKey.trim()) return;
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbApiKey: apiKey.trim() }),
      });
      setSaved(true);
      setKeySet(true);
      setApiKey("");
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/tmdb-test");
      setTestResult(res.ok ? "ok" : "error");
    } catch {
      setTestResult("error");
    } finally {
      setTesting(false);
    }
  }

  async function handleRemove() {
    if (!confirm("Czy na pewno chcesz usunąć klucz API TMDB?")) return;
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tmdbApiKey: "" }),
    });
    setKeySet(false);
    setTestResult(null);
  }

  // ── Filmweb handlers ───────────────────────────────────────────────────────

  async function handleFwSave() {
    if (!fwEmail.trim() || !fwPassword.trim()) return;
    const api = (window as any).electronAPI;
    setFwSaving(true);
    try {
      await api.saveCredentials(fwEmail, fwPassword);
      setFwCredsSaved(true);
      setFwSaved(true);
      setTimeout(() => setFwSaved(false), 3000);
    } finally {
      setFwSaving(false);
    }
  }

  async function handleFwClear() {
    if (!confirm("Czy na pewno chcesz usunąć zapisane dane logowania Filmweb?")) return;
    const api = (window as any).electronAPI;
    setFwClearing(true);
    try {
      await api.clearCredentials();
      setFwEmail("");
      setFwPassword("");
      setFwCredsSaved(false);
    } finally {
      setFwClearing(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Filmweb ─────────────────────────────────────────────────────────── */}
      {isElectron && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
          <div className="mb-4 flex items-center gap-2">
            <LogIn size={16} className="text-emerald-500 dark:text-emerald-400" />
            <h2 className="font-semibold text-slate-900 dark:text-white">
              Dane logowania Filmweb
            </h2>
          </div>

          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            Dane są przechowywane lokalnie w zaszyfrowanym pliku i używane
            wyłącznie przez scraper do automatycznego logowania.
          </p>

          {fwCredsSaved && (
            <div className="mb-4 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm dark:border-emerald-400/20 dark:bg-emerald-400/5">
              <span className="text-emerald-700 dark:text-emerald-300">
                ✓ Dane logowania są zapisane
              </span>
              <button
                onClick={handleFwClear}
                disabled={fwClearing}
                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
              >
                {fwClearing
                  ? <Loader2 size={12} className="animate-spin" />
                  : <Trash2 size={12} />}
                Usuń zapisane dane
              </button>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                E-mail
              </label>
              <input
                type="email"
                value={fwEmail}
                onChange={(e) => setFwEmail(e.target.value)}
                placeholder="twoj@email.pl"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-400/50 focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white dark:placeholder-slate-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                Hasło
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={fwPassword}
                  onChange={(e) => setFwPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 pr-10 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-400/50 focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white dark:placeholder-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button
              onClick={handleFwSave}
              disabled={fwSaving || !fwEmail.trim() || !fwPassword.trim()}
              className="flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50"
            >
              {fwSaving
                ? <Loader2 size={14} className="animate-spin" />
                : fwSaved
                  ? <Check size={14} />
                  : null}
              {fwSaved ? "Zapisano!" : "Zapisz dane logowania"}
            </button>
          </div>
        </div>
      )}

      {/* ── TMDB ────────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
        <div className="mb-4 flex items-center gap-2">
          <Key size={16} className="text-emerald-500 dark:text-emerald-400" />
          <h2 className="font-semibold text-slate-900 dark:text-white">TMDB API Key</h2>
        </div>

        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          Klucz API z{" "}
          <a
            href="https://www.themoviedb.org/settings/api"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-emerald-600 hover:underline dark:text-emerald-300"
          >
            themoviedb.org <ExternalLink size={11} />
          </a>{" "}
          — wymagany do automatycznego uzupełniania IMDB ID i TMDB ID przed
          eksportem. Rejestracja i klucz są bezpłatne.
        </p>

        {keySet && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm dark:border-emerald-400/20 dark:bg-emerald-400/5">
            <span className="text-emerald-700 dark:text-emerald-300">
              ✓ Klucz API jest zapisany
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={handleTest}
                disabled={testing}
                className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              >
                {testing ? <Loader2 size={12} className="animate-spin" /> : null}
                Testuj połączenie
              </button>
              <button
                onClick={handleRemove}
                className="text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
              >
                Usuń klucz
              </button>
            </div>
          </div>
        )}

        {testResult === "ok" && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/5 dark:text-emerald-300">
            <Check size={14} /> Połączenie działa poprawnie
          </div>
        )}
        {testResult === "error" && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600 dark:border-red-400/20 dark:bg-red-400/5 dark:text-red-300">
            <X size={14} /> Błąd — sprawdź klucz API
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={keySet ? "Wklej nowy klucz aby zastąpić…" : "Wklej klucz API…"}
            className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-400/50 focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white dark:placeholder-slate-500"
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
          <button
            onClick={handleSave}
            disabled={saving || !apiKey.trim()}
            className="flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50"
          >
            {saving
              ? <Loader2 size={14} className="animate-spin" />
              : saved
                ? <Check size={14} />
                : null}
            {saved ? "Zapisano!" : "Zapisz"}
          </button>
        </div>
      </div>
    </div>
  );
}