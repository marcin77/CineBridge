import type { mediaItems } from "@/db/schema";
const isTitle = (i: MediaItem) => i.type === "movie" || i.type === "show";

type MediaItem = typeof mediaItems.$inferSelect;

export type ExportFormat = "letterboxd" | "trakt" | "universal" | "simkl";

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatSimklDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  const day   = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year  = date.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

function formatDate(d: Date | string | null | undefined, short = false): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  if (short) return date.toISOString().slice(0, 10);
  return date.toISOString();
}

// ─── Letterboxd format ────────────────────────────────────────────────────────
// Compatible with Letterboxd CSV import
// Cols: Title, Year, Directors, WatchedDate, Rating10, Rating, Review, Tags
const LETTERBOXD_HEADER = ["tmdbID", "imdbID", "Title", "Year", "Directors", "WatchedDate", "Rating10", "Rating", "Review", "Tags"];

function toLetterboxdRow(item: MediaItem): string {
  const rating10 = item.userRating ?? "";
  // Letterboxd native rating is 0.5–5 in 0.5 steps
  const rating5 = item.userRating ? (item.userRating / 2).toFixed(1) : "";
  const tags = [
    item.category === "watchlist" ? "watchlist" : "",
    item.category === "favorite"  ? "favorite"  : "",
    item.listName ?? "",
    item.type === "show"           ? "serial"    : "",
    item.episodeTitleEn ?? item.episodeTitle ?? "",
  ]
    .filter(Boolean)
    .join(", ");

  // Konwertuj director ze srednikow (scraper format) na przecinki (Letterboxd format)
  // Scraper: "Lana Wachowski; Lilly Wachowski" -> Letterboxd: "Lana Wachowski, Lilly Wachowski"
  const directors = item.director
    ? item.director.split(";").map((d) => d.trim()).join(", ")
    : "";

  return [
    item.tmdbId ?? "",
    item.imdbId ?? "",
    cleanTitle(item.matchedTitle ?? item.originalTitle ?? item.title),
    item.matchedYear  ?? item.year ?? "",
    directors,
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
  const rows = items
    .filter((item) => item.type === "movie") // tylko filmy
    .map(toLetterboxdRow);
  return [LETTERBOXD_HEADER.join(","), ...rows].join("\n");
}

// ─── Letterboxd helpers ───────────────────────────────────────────────────────

export interface LetterboxdZipEntry {
  filename: string;
  content: string;
}

export function buildLetterboxdZipEntries(items: MediaItem[]): LetterboxdZipEntry[] {
  const entries: LetterboxdZipEntry[] = [];

  // 1. Obejrzane filmy
  const watched = items.filter(
    (i) => i.type === "movie" && i.category === "watched"
  );
  if (watched.length > 0) {
    entries.push({
      filename: "watched.csv",
      content: buildLetterboxdCsv(watched),
    });
  }

// 2. Watchlist (tylko filmy)
const watchlist = items.filter(
  (i) => i.type === "movie" && i.category === "watchlist"
);
if (watchlist.length > 0) {
  const WATCHLIST_HEADER = ["tmdbID", "imdbID", "Title", "Year", "Directors"];
  const rows = watchlist.map((item) => {
    const directors = item.director
      ? item.director.split(";").map((d) => d.trim()).join(", ")
      : "";
    return [
      item.tmdbId ?? "",
      item.imdbId ?? "",
      cleanTitle(item.matchedTitle ?? item.originalTitle ?? item.title),
      item.matchedYear ?? item.year ?? "",
      directors,
    ]
      .map(csvEscape)
      .join(",");
  });
  entries.push({
    filename: "watchlist.csv",
    content: [WATCHLIST_HEADER.join(","), ...rows].join("\n"),
  });
}

// 3. Listy — osobny plik dla każdej unikalnej listy
const listItems = items.filter(
  (i) => i.type === "movie" && i.category === "list" && i.listName
);

// Grupuj po listName
const listMap = new Map<string, MediaItem[]>();
for (const item of listItems) {
  const name = item.listName!;
  if (!listMap.has(name)) listMap.set(name, []);
  listMap.get(name)!.push(item);
}

for (const [listName, listMovies] of listMap.entries()) {
  const safeFilename = listName
    .replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ\s-_]/g, "")
    .trim()
    .replace(/\s+/g, "_");

  const LIST_HEADER = ["tmdbID", "imdbID", "Title", "Year", "Directors"];
  const rows = listMovies.map((item) => {
    const directors = item.director
      ? item.director.split(";").map((d) => d.trim()).join(", ")
      : "";
    return [
       item.tmdbId ?? "",
       item.imdbId ?? "",
      cleanTitle(item.matchedTitle ?? item.originalTitle ?? item.title),
      item.matchedYear ?? item.year ?? "",
      directors,
    ]
      .map(csvEscape)
      .join(",");
  });

  entries.push({
    filename: `lists/${safeFilename}.csv`,
    content: [LIST_HEADER.join(","), ...rows].join("\n"),
  });
}

  return entries;
}

// ─── Universal / CineBridge format ───────────────────────────────────────────
const UNIVERSAL_HEADER = [
  "type", "title", "original_title", "year", "director",
  "filmweb_id", "imdb_id", "tmdb_id",
  "category", "user_rating", "rated_at", "watched_at", "comment",
  "list_name", "list_id", "list_status", "favorite",
  "parent_show_id", "season_number", "episode_number", "episode_title", "episode_title_en",
];

function toUniversalRow(item: MediaItem): string {
  return [
    item.type,
    cleanTitle(item.title),
    item.originalTitle ?? "",
    item.matchedYear ?? item.year ?? "",
    item.director ?? "",
    item.sourceId ?? "",
    item.imdbId ?? "",
    item.tmdbId ?? "",
    item.category,
    item.userRating ?? "",
    formatDate(item.ratedAt, true),
    formatDate(item.watchedAt, true),
    item.comment ?? "",
    item.listName ?? "",
    item.listId ?? "",
    item.listStatus ?? "",
    item.favorite ?? "",
    item.parentShowId ?? "",
    item.seasonNumber ?? "",
    item.episodeNumber ?? "",
    item.episodeTitle ?? "",
    item.episodeTitleEn ?? "",
  ].map(csvEscape).join(",");
}

function cleanTitle(title: string | null | undefined): string {
  if (!title) return "";
  return title
    .replace(/²/g, "2")
    .replace(/³/g, "3")
    .replace(/¹/g, "1")
    .replace(/^[\u201c\u201d\u201e\u00ab\u00bb"'«»]+|[\u201c\u201d\u201e\u00ab\u00bb"'«»]+$/g, "")
    .trim();
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
    cleanTitle(item.matchedTitle ?? item.originalTitle ?? item.title),
    item.matchedYear  ?? item.year ?? "",
    item.imdbId       ?? "",
    item.tmdbId       ?? "",
    item.category,
    item.userRating   ?? "",
    formatDate(item.ratedAt),
    formatDate(item.watchedAt),
    item.listName     ?? "",
    item.comment      ?? "",
    item.episodeTitleEn ?? item.episodeTitle ?? "",
  ]
    .map(csvEscape)
    .join(",");
}

export function buildTraktCsv(items: MediaItem[]): string {
  const rows = items.filter(isTitle).map(toTraktRow);
  return [TRAKT_HEADER.join(","), ...rows].join("\n");
}

export function buildSimklCsv(items: MediaItem[]): string {
  const rows = items
    .filter(isTitle)
    .map(item => toSimklRow(item, items))
    .filter((r): r is string => r !== null);
  return [SIMKL_HEADER.join(","), ...rows].join("\n");
}

// ─── Simkl format ─────────────────────────────────────────────────────────────
// https://simkl.com/apps/import/csv/
const SIMKL_HEADER = [
  "Type",
  "IMDB_ID",
  "TMDB_ID",
  "Title",
  "Year",
  "Watchlist",
  "WatchedDate",
  "Rating",
  "LastEpWatched",
  "Memo",
];

function lastEpWatched(item: MediaItem, items: MediaItem[]): string {
  if (item.type !== "show") return "";
  // Znajdź ostatni obejrzany odcinek dla tego serialu
  const episodes = items.filter(
    i =>
      i.type === "episode" &&
      i.parentShowId === item.sourceId &&
      i.category === "watched" &&
      i.seasonNumber !== null &&
      i.episodeNumber !== null,
  );
  if (episodes.length === 0) return "";
  // Sortuj po sezonie i odcinku — weź ostatni
  episodes.sort((a, b) => {
    if (a.seasonNumber !== b.seasonNumber) return (b.seasonNumber ?? 0) - (a.seasonNumber ?? 0);
    return (b.episodeNumber ?? 0) - (a.episodeNumber ?? 0);
  });
  const last = episodes[0];
  const s = String(last.seasonNumber ?? 0).padStart(2, "0");
  const e = String(last.episodeNumber ?? 0).padStart(2, "0");
  return `S${s}E${e}`;
}

function toSimklRow(item: MediaItem, items: MediaItem[]): string | null {
  const status = simklWatchlistStatus(item);
  if (status === null) return null;

  return [
    simklType(item),
    item.imdbId ?? "",
    item.tmdbId ?? "",
    cleanTitle(item.matchedTitle ?? item.originalTitle ?? item.title),
    item.matchedYear ?? item.year ?? "",
    status,
    formatSimklDate(item.watchedAt ?? item.ratedAt),
    item.userRating ?? "",
    lastEpWatched(item, items),
    item.comment ?? "",
  ]
    .map(csvEscape)
    .join(",");
}

function simklType(item: MediaItem): string {
  return item.type === "show" ? "tv" : "movie";
}

function simklWatchlistStatus(item: MediaItem): string | null {
  if (item.category === "watched") return "completed";
  if (item.category === "watchlist") return "plan to watch";
  // category === "list" lub cokolwiek innego → pomijamy
  return null;
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────
export function buildCsv(items: MediaItem[], format: ExportFormat): string {
  switch (format) {
    case "letterboxd": return buildLetterboxdCsv(items);
    case "trakt":      return buildTraktCsv(items);
    case "simkl":      return buildSimklCsv(items);
    default:           return buildUniversalCsv(items);
  }
}

export function csvFilename(batchFilename: string, format: ExportFormat): string {
  const base = batchFilename.replace(/\.[^.]+$/, "");
  return `cinebridge-${format}-${base}.csv`;
}
