"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

interface Props {
  batchId: number;
  filename: string;
  redirectTo?: string;
}

export default function DeleteBatchButton({ batchId, filename, redirectTo }: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Czy na pewno chcesz usunąć import "${filename}"? Tej operacji nie można cofnąć.`)) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/import/${batchId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Nie udało się usunąć importu.");
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Błąd usuwania");
      setDeleting(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 hover:underline disabled:opacity-50"
      title="Usuń import"
    >
      <Trash2 size={12} />
      {deleting ? "Usuwanie…" : "Usuń"}
    </button>
  );
}
