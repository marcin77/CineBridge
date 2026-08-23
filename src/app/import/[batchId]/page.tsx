import { db } from "@/db";
import { importBatches, mediaItems } from "@/db/schema";
import { eq, count, asc, desc, and, or, isNotNull, ne, sql } from "drizzle-orm";
import { Heart, Folder } from "lucide-react";
import { notFound } from "next/navigation";
import Link from "next/link";
import DeleteBatchButton from "@/components/DeleteBatchButton";
import { ArrowLeft, FileText, Star, MessageSquare, List } from "lucide-react";
import BatchExportPanel from "./BatchExportPanel";
import BatchItemsTable from "./BatchItemsTable";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<{ page?: string; filter?: string; q?: string }>;
}

export default async function BatchDetailPage({ params, searchParams }: Props) {
  const { batchId } = await params;
  const { page: pageStr, filter, q } = await searchParams;

  const id = Number(batchId);
  if (Number.isNaN(id)) notFound();

  const [batch] = await db.select().from(importBatches).where(eq(importBatches.id, id));
  if (!batch) notFound();

  const page = Math.max(1, Number(pageStr ?? "1"));
  const perPage = 50;
  const offset = (page - 1) * perPage;

  const baseWhere = eq(mediaItems.importBatchId, id);

  const [{ value: total }] = await db.select({ value: count() }).from(mediaItems).where(baseWhere);

  const items = await db
    .select()
    .from(mediaItems)
    .where(baseWhere)
    .orderBy(
      desc(mediaItems.ratedAt),
      desc(mediaItems.watchedAt),
      asc(mediaItems.title)
    )
    .limit(perPage)
    .offset(offset);

  const totalPages = Math.ceil(total / perPage);

  const [
    [{ value: watchedCount }],
    [{ value: watchlistCount }],
    [{ value: favoriteCount }],
    [{ value: commentedCount }],
    [{ value: listsCount }],
  ] = await Promise.all([
    db.select({ value: count() }).from(mediaItems).where(and(eq(mediaItems.importBatchId, id), eq(mediaItems.category, "watched"))),
    db.select({ value: count() }).from(mediaItems).where(and(eq(mediaItems.importBatchId, id), eq(mediaItems.category, "watchlist"))),
    db.select({ value: count() }).from(mediaItems).where(and(eq(mediaItems.importBatchId, id), or(eq(mediaItems.category, "favorite"), eq(mediaItems.favorite, "tak")))),
    db.select({ value: count() }).from(mediaItems).where(and(eq(mediaItems.importBatchId, id), isNotNull(mediaItems.comment), ne(mediaItems.comment, ""))),
    db.select({ value: sql<number>`count(distinct ${mediaItems.listId})` }).from(mediaItems).where(and(eq(mediaItems.importBatchId, id), isNotNull(mediaItems.listId), ne(mediaItems.listId, ""))),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Link href="/import"
        className="mb-6 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
        <ArrowLeft size={14} /> Powrót do importów
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileText size={18} className="text-slate-400" />
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{batch.filename}</h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {batch.totalItems} pozycji · zaimportowano {new Date(batch.createdAt).toLocaleString("pl-PL")}
          </p>
        </div>
        <DeleteBatchButton batchId={id} filename={batch.filename} redirectTo="/import" />
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { icon: Star,          label: "Obejrzane",     value: watchedCount,   color: "from-sky-400 to-blue-500" },
          { icon: List,          label: "Chce zobaczyć", value: watchlistCount, color: "from-amber-400 to-orange-500" },
          { icon: Heart,         label: "Ulubione",      value: favoriteCount,  color: "from-red-400 to-pink-500" },
          { icon: MessageSquare, label: "Z komentarzem", value: commentedCount, color: "from-emerald-400 to-teal-500" },
          { icon: Folder,        label: "Listy",         value: listsCount,     color: "from-purple-400 to-violet-500" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
            <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${color} text-slate-950`}>
              <Icon size={15} />
            </div>
            <div className="text-lg font-semibold text-slate-900 dark:text-white">{value}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
          </div>
        ))}
      </div>

      <BatchExportPanel batchId={id} filename={batch.filename} />

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
        <div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between dark:border-white/10">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Pozycje ({total})</h2>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            Strona {page} z {Math.max(1, totalPages)}
          </div>
        </div>

        <BatchItemsTable items={items} />

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-white/10">
            <Link href={`/import/${id}?page=${Math.max(1, page - 1)}`}
              className={`rounded-lg border border-slate-200 px-3 py-1.5 text-xs transition hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5 ${
                page <= 1 ? "pointer-events-none opacity-40" : "text-slate-900 dark:text-white"
              }`}>
              ← Poprzednia
            </Link>
            <span className="text-xs text-slate-400">
              {offset + 1}–{Math.min(offset + perPage, total)} z {total}
            </span>
            <Link href={`/import/${id}?page=${Math.min(totalPages, page + 1)}`}
              className={`rounded-lg border border-slate-200 px-3 py-1.5 text-xs transition hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5 ${
                page >= totalPages ? "pointer-events-none opacity-40" : "text-slate-900 dark:text-white"
              }`}>
              Następna →
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
