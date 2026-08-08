"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Download,
  Loader2,
  RefreshCw,
  Search,
  Wand2,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Trash2,
} from "lucide-react";

interface MediaItem {
  id: number;
  title: string;
  originalTitle: string | null;
  year: number | null;
  type: string;
  category: string;
  userRating: number | null;
  watchedAt: string | null;
  ratedAt: string | null;
  comment: string | null;
  matchStatus: string;
  matchConfidence: number | null;
  matchedTitle: string | null;
  matchedYear: number | null;
  imdbId: string | null;
  traktType: string | null;
  syncedToTrakt: boolean;
  syncError: string | null;
}

interface Batch {
  id: number;
  filename: string;
  category: string;
  status: string;
  totalItems: number;
  matchedItems: number;
  unmatchedItems: number;
  syncedItems: number;
}

interface StatusCount {
  status: string;
  value: number;
}

const STATUS_META: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  matched: { label: "Dopasowane", color: "text-emerald-300 bg-emerald-400/10", icon: CheckCircle2 },
  manual: { label: "Do weryfikacji", color: "text-amber-300 bg-amber-400/10", icon: HelpCircle },
  unmatched: { label: "Brak dopasowania", color: "text-red-300 bg-red-400/10", icon: AlertTriangle },
  pending: { label: "Oczekuje", color: "text-slate-300 bg-white/10", icon: Loader2 },
};

export default function BatchDetail({ batchId }: { batchId: number }) {
  const [batch, setBatch] = useState<Batch | null>(null);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [statusCounts, setStatusCounts] = useState<StatusCount[]>([]);
  const [filter, setFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [traktConnected, setTraktConnected] = useState(false);
  const [includeComments, setIncludeComments] = useState(false);
  const [searchModal, setSearchModal] = useState<MediaItem | null>(null);

  const pageSize = 30;

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (filter) params.set("status", filter);
    const res = await fetch(`/api/import/${batchId}?${params.toString()}`);
    const data = await res.json();
    if (res.ok) {
      setBatch(data.batch);
      setItems(data.items);
      setTotal(data.pagination.total);
      setStatusCounts(data.statusCounts);
    }
    setLoading(false);
  }, [batchId, page, filter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/trakt/status")
      .then((r) => r.json())
      .then((d) => setTraktConnected(Boolean(d.connected)));
  }, []);

  async function runAutoMatch() {
    setMatching(true);
    let remaining = 1;
    try {
      while (remaining > 0) {
        const res = await fetch(`/api/import/${batchId}/match`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) {
          setProgress(data.error ?? "Błąd dopasowywania");
          break;
        }
        remaining = data.remaining;
        setProgress(`Dopasowywanie… pozostało ${remaining} pozycji`);
        await load();
      }
    } finally {
      setMatching(false);
      setProgress(null);
      await load();
    }
  }

  async function runSync() {
    setSyncing(true);
    let remaining = 1;
    try {
      while (remaining > 0) {
        const res = await fetch(`/api/import/${batchId}/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ includeComments }),
        });
        const data = await res.json();
        if (!res.ok) {
          setProgress(data.error ?? "Błąd synchronizacji");
          break;
        }
        remaining = data.remaining;
        setProgress(`Synchronizacja z Trakt… pozostało ${remaining} pozycji`);
        await load();
      }
    } finally {
      setSyncing(false);
      setProgress(null);
      await load();
    }
  }

  async function deleteBatch() {
    if (!confirm("Usunąć ten import wraz ze wszystkimi pozycjami?")) return;
    await fetch(`/api/import/${batchId}`, { method: "DELETE" });
    window.location.href = "/import";
  }

  if (loading && !batch) {
    return <div className="text-slate-400">Ładowanie…</div>;
  }
  if (!batch) {
    return <div className="text-slate-400">Nie znaleziono importu.</div>;
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">{batch.filename}</h1>
          <p className="text-sm text-slate-400">
            {batch.category} · {batch.totalItems} pozycji · status: {batch.status}
          </p>
        </div>
        <button
          onClick={deleteBatch}
          className="flex items-center gap-1.5 rounded-lg border border-red-400/30 px-3 py-1.5 text-sm text-red-300 hover:bg-red-400/10"
        >
          <Trash2 size={14} /> Usuń import
        </button>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        {statusCounts.map((sc) => {
          const meta = STATUS_META[sc.status] ?? STATUS_META.pending;
          return (
            <button
              key={sc.status}
              onClick={() => {
                setFilter(filter === sc.status ? null : sc.status);
                setPage(1);
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${meta.color} ${
                filter === sc.status ? "ring-2 ring-emerald-400" : ""
              }`}
            >
              {meta.label}: {sc.value}
            </button>
          );
        })}
        {filter && (
          <button
            onClick={() => {
              setFilter(null);
              setPage(1);
            }}
            className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-slate-300"
          >
            Wyczyść filtr
          </button>
        )}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <button
          onClick={runAutoMatch}
          disabled={matching}
          className="flex items-center gap-2 rounded-lg bg-indigo-400 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-indigo-300 disabled:opacity-50"
        >
          {matching ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
          Dopasuj automatycznie
        </button>

        <a
          href={`/api/import/${batchId}/export`}
          className="flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
        >
          <Download size={15} /> Pobierz CSV (Trakt-ready)
        </a>

        <label className="flex items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={includeComments}
            onChange={(e) => setIncludeComments(e.target.checked)}
            className="accent-emerald-400"
          />
          Dołącz komentarze jako publiczne recenzje na Trakt
        </label>

        <button
          onClick={runSync}
          disabled={syncing || !traktConnected}
          title={!traktConnected ? "Połącz konto Trakt w zakładce Połączenia" : undefined}
          className="ml-auto flex items-center gap-2 rounded-lg bg-emerald-400 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-300 disabled:opacity-50"
        >
          {syncing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          Synchronizuj z Trakt
        </button>
      </div>

      {progress && <p className="mb-4 text-sm text-slate-400">{progress}</p>}
      {!traktConnected && (
        <p className="mb-4 text-xs text-amber-300">
          Aby synchronizować z Trakt, połącz konto w zakładce „Połączenia”.
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="p-3">Tytuł</th>
              <th className="p-3">Rok</th>
              <th className="p-3">Ocena</th>
              <th className="p-3">Data</th>
              <th className="p-3">Dopasowanie</th>
              <th className="p-3">Sync</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {items.map((item) => {
              const meta = STATUS_META[item.matchStatus] ?? STATUS_META.pending;
              const Icon = meta.icon;
              return (
                <tr key={item.id}>
                  <td className="p-3">
                    <div className="font-medium text-white">{item.title}</div>
                    {item.matchedTitle && item.matchedTitle !== item.title && (
                      <div className="text-xs text-slate-500">→ {item.matchedTitle}</div>
                    )}
                  </td>
                  <td className="p-3 text-slate-400">{item.year ?? "—"}</td>
                  <td className="p-3 text-slate-400">{item.userRating ?? "—"}</td>
                  <td className="p-3 text-slate-400">
                    {(item.watchedAt ?? item.ratedAt)?.slice(0, 10) ?? "—"}
                  </td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${meta.color}`}>
                      <Icon size={12} /> {meta.label}
                      {item.matchConfidence != null ? ` (${item.matchConfidence}%)` : ""}
                    </span>
                  </td>
                  <td className="p-3">
                    {item.syncedToTrakt ? (
                      <span className="text-emerald-300 text-xs">✓ zsynchronizowano</span>
                    ) : item.syncError ? (
                      <span className="text-red-300 text-xs">błąd</span>
                    ) : (
                      <span className="text-slate-500 text-xs">—</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => setSearchModal(item)}
                      className="flex items-center gap-1 text-xs text-emerald-300 hover:underline"
                    >
                      <Search size={12} /> Dopasuj ręcznie
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
        <span>
          Strona {page} z {totalPages} ({total} pozycji)
        </span>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-white/10 px-3 py-1 disabled:opacity-40"
          >
            Poprzednia
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-white/10 px-3 py-1 disabled:opacity-40"
          >
            Następna
          </button>
        </div>
      </div>

      {searchModal && (
        <ManualMatchModal
          item={searchModal}
          onClose={() => setSearchModal(null)}
          onMatched={async () => {
            setSearchModal(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

interface SearchResult {
  type: "movie" | "show";
  title: string;
  year: number | null;
  imdbId: string | null;
  tmdbId: string | null;
  traktId: number;
  score: number;
}

function ManualMatchModal({
  item,
  onClose,
  onMatched,
}: {
  item: MediaItem;
  onClose: () => void;
  onMatched: () => void;
}) {
  const [query, setQuery] = useState(item.title);
  const [year, setYear] = useState(item.year ? String(item.year) : "");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  async function search() {
    setLoading(true);
    const params = new URLSearchParams({ q: query });
    if (year) params.set("year", year);
    const res = await fetch(`/api/trakt/search?${params.toString()}`);
    const data = await res.json();
    setResults(data.results ?? []);
    setLoading(false);
  }

  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function selectResult(r: SearchResult) {
    await fetch(`/api/media-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selectedMatch: r }),
    });
    onMatched();
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6">
        <h3 className="mb-4 text-lg font-semibold text-white">Dopasuj ręcznie: {item.title}</h3>
        <div className="mb-4 flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white"
            placeholder="Tytuł"
          />
          <input
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="w-24 rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white"
            placeholder="Rok"
          />
          <button
            onClick={search}
            className="rounded-lg bg-emerald-400 px-3 py-2 text-sm font-medium text-slate-950"
          >
            Szukaj
          </button>
        </div>
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {loading && <p className="text-sm text-slate-400">Szukanie…</p>}
          {!loading && results.length === 0 && <p className="text-sm text-slate-400">Brak wyników.</p>}
          {results.map((r) => (
            <button
              key={`${r.type}-${r.traktId}`}
              onClick={() => selectResult(r)}
              className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-left text-sm hover:border-emerald-400/50"
            >
              <span>
                {r.title} {r.year ? `(${r.year})` : ""}
              </span>
              <span className="text-xs text-slate-500">{r.type === "show" ? "serial" : "film"}</span>
            </button>
          ))}
        </div>
        <button onClick={onClose} className="mt-4 w-full rounded-lg border border-white/10 py-2 text-sm text-slate-300">
          Zamknij
        </button>
      </div>
    </div>
  );
}
