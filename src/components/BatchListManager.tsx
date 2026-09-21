"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  FileText,
  Trash2,
  CheckSquare,
  Square,
  History,
} from "lucide-react";

interface Batch {
  id: number;
  filename: string;
  totalItems: number;
  status: string;
  createdAt: string;
}

interface Props {
  batches: Batch[];
}

const STATUS_LABEL: Record<string, string> = {
  uploaded:  "Wczytano",
  ready:     "Gotowe",
  completed: "Zakończono",
  failed:    "Błąd",
};

const STATUS_COLOR: Record<string, string> = {
  uploaded:
    "bg-sky-100 text-sky-700 dark:bg-sky-400/20 dark:text-sky-300",
  ready:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-300",
  completed:
    "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-400/20 dark:text-fuchsia-300",
  failed:
    "bg-red-100 text-red-700 dark:bg-red-400/20 dark:text-red-300",
};

export default function BatchListManager({ batches }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);

  // Najnowszy batch = największe ID — chroniony przy "Wyczyść historię"
  const newestId =
    batches.length > 0 ? Math.max(...batches.map((b) => b.id)) : null;

  const allIds = batches.map((b) => b.id);
  const allSelected =
    allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;
  const busy = deleting || isPending;

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allIds));
  }

  async function deleteIds(ids: number[], confirmMsg: string) {
    if (!confirm(confirmMsg)) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/import/batch-delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Nie udało się usunąć.");
      }
      setSelected(new Set());
      startTransition(() => router.refresh());
    } catch (err) {
      alert(err instanceof Error ? err.message : "Błąd usuwania");
    } finally {
      setDeleting(false);
    }
  }

  function handleDeleteSelected() {
    const ids = [...selected];
    const n = ids.length;
    const suffix =
      n === 1 ? "y import" : n < 5 ? "e importy" : "ych importów";
    deleteIds(
      ids,
      `Czy na pewno chcesz usunąć ${n} zaznaczon${suffix}?\nTej operacji nie można cofnąć.`,
    );
  }

  function handleClearHistory() {
    if (!newestId) return;
    const toDelete = allIds.filter((id) => id !== newestId);
    if (toDelete.length === 0) {
      alert("Masz tylko jeden import — nie ma historii do wyczyszczenia.");
      return;
    }
    const n = toDelete.length;
    const suffix =
      n === 1 ? "y starszy import" : n < 5 ? "e starsze importy" : "ych starszych importów";
    deleteIds(
      toDelete,
      `Czy na pewno chcesz usunąć ${n} starszych importów?\nNajnowszy import zostanie zachowany.\nTej operacji nie można cofnąć.`,
    );
  }

  if (batches.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Brak importów.
      </p>
    );
  }

  return (
    <div>
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Zaznacz wszystkie */}
        <button
          onClick={toggleAll}
          disabled={busy}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 disabled:opacity-40 dark:text-slate-400 dark:hover:text-slate-200"
        >
          {allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
          {allSelected ? "Odznacz wszystkie" : "Zaznacz wszystkie"}
        </button>

        <span className="h-4 w-px bg-slate-200 dark:bg-white/10" />

        {/* Usuń zaznaczone */}
        <button
          onClick={handleDeleteSelected}
          disabled={!someSelected || busy}
          className="inline-flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-400 dark:hover:text-red-300"
        >
          <Trash2 size={14} />
          {someSelected
            ? `Usuń zaznaczone (${selected.size})`
            : "Usuń zaznaczone"}
        </button>

        <span className="h-4 w-px bg-slate-200 dark:bg-white/10" />

        {/* Wyczyść historię */}
        <button
          onClick={handleClearHistory}
          disabled={busy || batches.length <= 1}
          className="inline-flex items-center gap-1.5 text-xs text-orange-500 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-orange-400 dark:hover:text-orange-300"
          title="Usuwa wszystkie importy oprócz najnowszego"
        >
          <History size={14} />
          Wyczyść historię
        </button>

        {/* Licznik zaznaczonych */}
        {someSelected && (
          <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">
            Zaznaczono: {selected.size} / {batches.length}
          </span>
        )}
      </div>

      {/* ── Tabela ──────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[580px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
            <tr>
              <th className="pb-3 pr-3 w-8" />
              <th className="pb-3 pr-4">Plik</th>
              <th className="pb-3 pr-4">Pozycje</th>
              <th className="pb-3 pr-4">Status</th>
              <th className="pb-3 pr-4">Data</th>
              <th className="pb-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {batches.map((b) => {
              const isChecked = selected.has(b.id);
              const isNewest = b.id === newestId;

              return (
                <tr
                  key={b.id}
                  className={`transition-colors ${
                    isChecked
                      ? "bg-red-50/70 dark:bg-red-400/5"
                      : "hover:bg-slate-50 dark:hover:bg-white/[0.03]"
                  }`}
                >
                  {/* Checkbox */}
                  <td className="py-3 pr-3">
                    <button
                      onClick={() => toggleOne(b.id)}
                      disabled={busy}
                      className="text-slate-300 hover:text-red-400 disabled:opacity-40 dark:text-slate-600 dark:hover:text-red-400"
                      title={isChecked ? "Odznacz" : "Zaznacz do usunięcia"}
                    >
                      {isChecked ? (
                        <CheckSquare size={15} className="text-red-400" />
                      ) : (
                        <Square size={15} />
                      )}
                    </button>
                  </td>

                  {/* Plik */}
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-white">
                      <FileText
                        size={14}
                        className="shrink-0 text-slate-400 dark:text-slate-500"
                      />
                      <span className="max-w-[200px] truncate">
                        {b.filename}
                      </span>
                      {isNewest && (
                        <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-300">
                          najnowszy
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Pozycje */}
                  <td className="py-3 pr-4 tabular-nums text-slate-500 dark:text-slate-400">
                    {b.totalItems}
                  </td>

                  {/* Status */}
                  <td className="py-3 pr-4">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_COLOR[b.status] ??
                        "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"
                      }`}
                    >
                      {STATUS_LABEL[b.status] ?? b.status}
                    </span>
                  </td>

                  {/* Data */}
                  <td className="py-3 pr-4 text-xs tabular-nums text-slate-400 dark:text-slate-500">
                    {new Date(b.createdAt).toLocaleString("pl-PL")}
                  </td>

                  {/* Akcja */}
                  <td className="py-3 text-right">
                    <Link
                      href={`/import/${b.id}`}
                      className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline dark:text-emerald-300"
                    >
                      Otwórz <ArrowRight size={12} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}