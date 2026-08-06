import type { mediaItems } from "@/db/schema";

type MediaItem = typeof mediaItems.$inferSelect;

function csvEscape(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const HEADER = [
  "type",
  "title",
  "year",
  "imdb_id",
  "tmdb_id",
  "category",
  "rating",
  "rated_at",
  "watched_at",
  "list_name",
  "comment",
];

export function buildTraktCsv(items: MediaItem[]): string {
  const rows = items.map((item) =>
    [
      item.traktType ?? item.type,
      item.matchedTitle ?? item.title,
      item.matchedYear ?? item.year ?? "",
      item.imdbId ?? "",
      item.tmdbId ?? "",
      item.category,
      item.userRating ?? "",
      item.ratedAt ? item.ratedAt.toISOString() : "",
      item.watchedAt ? item.watchedAt.toISOString() : "",
      item.listName ?? "",
      item.comment ?? "",
    ]
      .map(csvEscape)
      .join(","),
  );

  return [HEADER.join(","), ...rows].join("\n");
}
