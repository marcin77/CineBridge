"use client";

import { useState } from "react";
import { Key, Check, X, Loader2, ExternalLink } from "lucide-react";

interface Props {
  hasApiKey: boolean;
}

export default function SettingsForm({ hasApiKey }: Props) {
  const [apiKey, setApiKey]     = useState("");
  const [saving, setSaving]     = useState(false);
  const [testing, setTesting]   = useState(false);
  const [saved, setSaved]       = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "error" | null>(null);
  const [keySet, setKeySet]     = useState(hasApiKey);

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

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="mb-4 flex items-center gap-2">
        <Key size={16} className="text-emerald-400" />
        <h2 className="font-semibold text-white">TMDB API Key</h2>
      </div>

      <p className="mb-4 text-sm text-slate-400">
        Klucz API z{" "}
        <a
          href="https://www.themoviedb.org/settings/api"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-emerald-300 hover:underline"
        >
          themoviedb.org <ExternalLink size={11} />
        </a>{" "}
        — wymagany do automatycznego uzupełniania IMDB ID i TMDB ID przed eksportem do Simkl.
        Rejestracja i klucz są bezpłatne.
      </p>

      {keySet && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-4 py-2.5 text-sm">
          <span className="text-emerald-300">✓ Klucz API jest zapisany</span>
          <div className="flex items-center gap-3">
            <button
              onClick={handleTest}
              disabled={testing}
              className="flex items-center gap-1 text-xs text-slate-300 hover:text-white"
            >
              {testing ? <Loader2 size={12} className="animate-spin" /> : null}
              Testuj połączenie
            </button>
            <button
              onClick={handleRemove}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Usuń klucz
            </button>
          </div>
        </div>
      )}

      {testResult === "ok" && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-4 py-2 text-sm text-emerald-300">
          <Check size={14} /> Połączenie działa poprawnie
        </div>
      )}
      {testResult === "error" && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-400/20 bg-red-400/5 px-4 py-2 text-sm text-red-300">
          <X size={14} /> Błąd — sprawdź klucz API
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={keySet ? "Wklej nowy klucz aby zastąpić…" : "Wklej klucz API…"}
          className="flex-1 rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-400/50 focus:outline-none"
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
        />
        <button
          onClick={handleSave}
          disabled={saving || !apiKey.trim()}
          className="flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
          {saved ? "Zapisano!" : "Zapisz"}
        </button>
      </div>
    </div>
  );
}