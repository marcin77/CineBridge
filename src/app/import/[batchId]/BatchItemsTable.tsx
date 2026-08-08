"use client";

import { useState } from "react";
import { MessageSquare, Star, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import type { mediaItems } from "@/db/schema";

type MediaItem = typeof mediaItems.$inferSelect;

interface Props {
  items: MediaItem[];
}

const CATEGORY_BADGE: Record<string, string> = {
  watched:   "bg-sky-400/20 text-sky-300",
  watchlist: "bg-amber-400/20 text-amber-300",
  favorite:  "bg-red-400/20 text-red-300",
};

const CATEGORY_LABEL: Record<string, string> = {
  watched:   "Obejrzane",
  watchlist: "Watchlist",
  favorite:  "Ulubione",
};

function ItemRow({ item }: { item: MediaItem }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr className="border-t border-white/5 hover:bg-white/[0.02]">
        {/* Type */}
        <td className="py-2.5 pl-4 pr-2 text-xs text-slate-500">
          {item.type === "show" ? "Serial" : "Film"}
        </td>

        {/* Title */}
        <td className="py-2.5 pr-4">
          <div className="font-medium text-white leading-tight">
            {item.title}
          </div>
          {item.originalTitle && item.originalTitle !== item.title && (
            <div className="text-[11px] text-slate-500">{item.originalTitle}</div>
          )}
        </td>

        {/* Year */}
        <td className="py-2.5 pr-4 text-sm text-slate-400">{item.year ?? "—"}</td>

        {/* Rating */}
        <td className="py-2.5 pr-4">
          {item.userRating ? (
            <span className="flex items-center gap-1 text-sm font-medium text-amber-300">
              <Star size={12} fill="currentColor" />
              {item.userRating}/10
            </span>
          ) : (
            <span className="text-xs text-slate-600">—</span>
          )}
        </td>

        {/* Date */}
        <td className="py-2.5 pr-4 text-xs text-slate-500">
          {(item.watchedAt ?? item.ratedAt)
            ? new Date((item.watchedAt ?? item.ratedAt)!).toLocaleDateString("pl-PL")
            : "—"}
        </td>

        {/* Category */}
        <td className="py-2.5 pr-4">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORY_BADGE[item.category] ?? "bg-white/10 text-slate-400"}`}>
            {CATEGORY_LABEL[item.category] ?? item.category}
          </span>
        </td>

        {/* Comment toggle */}
        <td className="py-2.5 pr-4 text-right">
          {item.comment ? (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 ml-auto"
            >
              <MessageSquare size={12} />
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          ) : null}
        </td>
      </tr>

      {/* Expanded comment row */}
      {expanded && item.comment && (
        <tr className="border-t border-white/5 bg-white/[0.015]">
          <td colSpan={7} className="px-4 pb-3 pt-2">
            <div className="flex items-start gap-2">
              <MessageSquare size={13} className="mt-0.5 shrink-0 text-emerald-400" />
              <p className="text-xs leading-relaxed text-slate-300">{item.comment}</p>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function BatchItemsTable({ items }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-slate-500">
            <th className="pb-2.5 pl-4 pr-2">Typ</th>
            <th className="pb-2.5 pr-4">Tytuł</th>
            <th className="pb-2.5 pr-4">Rok</th>
            <th className="pb-2.5 pr-4">Ocena</th>
            <th className="pb-2.5 pr-4">Data</th>
            <th className="pb-2.5 pr-4">Kategoria</th>
            <th className="pb-2.5 pr-4" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
