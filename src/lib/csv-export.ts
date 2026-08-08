import type { mediaItems } from "@/db/schema";

type MediaItem = typeof mediaItems.$inferSelect;

export type ExportFormat = "letterboxd" | "trakt" | "universal";

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDate(d: Date | null | undefined, short = false): string {
  if (!d) return "";
  if (short) return d.toISOString().slice(0, 10);
  return d.toISOString();
}

// ─── Letterboxd format ────────────────────────────────────────────────────────
// Compatible with Letterboxd CSV import
// Cols: Title,Year,WatchedDate,Rating10,Rating,Review,Tags
const LETTERBOXD_HEADER = ["Title", "Year", "WatchedDate", "Rating10", "Rating", "Review", "Tags"];

function toLetterboxdRow(item: MediaItem): string {
  const rating10 = item.userRating ?? "";
  // Letterboxd native rating is 0.5–5 in 0.5 steps
  const rating5 = item.userRating ? (item.userRating / 2).toFixed(1) : "";
  const tags = [
    item.category === "watchlist" ? "watchlist" : "",
    item.category === "favorite"  ? "favorite"  : "",
    item.listName ?? "",
    item.type === "show"           ? "serial"    : "",
  ]
    .filter(Boolean)
    .join(", ");

  return [
    item.matchedTitle ?? item.title,
    item.matchedYear  ?? item.year ?? "",
    formatDate(item.watchedAt ?? item.ratedAt, true),
    rating10,
    rating5,
    item.comment ?? "",
    tags,
  ]
    .map(csvEscape)
    .join(",");
}

export function buildLetterboxdCsv(items: MediaItem[]): string {
  const rows = items.map(toLetterboxdRow);
  return [LETTERBOXD_HEADER.join(","), ...rows].join("\n");
}

// ─── Universal / CineBridge format ───────────────────────────────────────────
// Full fidelity – all fields preserved
const UNIVERSAL_HEADER = [
  "type",
  "title",
  "original_title",
  "year",
  "filmweb_id",
  "imdb_id",
  "tmdb_id",
  "category",
  "user_rating",
  "rated_at",
  "watched_at",
  "comment",
  "list_name",
];

function toUniversalRow(item: MediaItem): string {
  return [
    item.type,
    item.matchedTitle ?? item.title,
    item.originalTitle ?? "",
    item.matchedYear  ?? item.year ?? "",
    item.sourceId     ?? "",
    item.imdbId       ?? "",
    item.tmdbId       ?? "",
    item.category,
    item.userRating   ?? "",
    formatDate(item.ratedAt,   true),
    formatDate(item.watchedAt, true),
    item.comment      ?? "",
    item.listName     ?? "",
  ]
    .map(csvEscape)
    .join(",");
}

export function buildUniversalCsv(items: MediaItem[]): string {
  const rows = items.map(toUniversalRow);
  return [UNIVERSAL_HEADER.join(","), ...rows].join("\n");
}

// ─── Trakt-ready format ───────────────────────────────────────────────────────
const TRAKT_HEADER = [
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

function toTraktRow(item: MediaItem): string {
  return [
    item.type,
    item.matchedTitle ?? item.title,
    item.matchedYear  ?? item.year ?? "",
    item.imdbId       ?? "",
    item.tmdbId       ?? "",
    item.category,
    item.userRating   ?? "",
    formatDate(item.ratedAt),
    formatDate(item.watchedAt),
    item.listName     ?? "",
    item.comment      ?? "",
  ]
    .map(csvEscape)
    .join(",");
}

export function buildTraktCsv(items: MediaItem[]): string {
  const rows = items.map(toTraktRow);
  return [TRAKT_HEADER.join(","), ...rows].join("\n");
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────
export function buildCsv(items: MediaItem[], format: ExportFormat): string {
  switch (format) {
    case "letterboxd": return buildLetterboxdCsv(items);
    case "trakt":      return buildTraktCsv(items);
    default:           return buildUniversalCsv(items);
  }
}

export function csvFilename(batchFilename: string, format: ExportFormat): string {
  const base = batchFilename.replace(/\.[^.]+$/, "");
  return `cinebridge-${format}-${base}.csv`;
}
