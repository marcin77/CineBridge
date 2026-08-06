import Papa from "papaparse";

export interface ParsedItem {
  title: string;
  originalTitle: string | null;
  year: number | null;
  type: "movie" | "show";
  userRating: number | null;
  ratedAt: Date | null;
  watchedAt: Date | null;
  comment: string | null;
  sourceId: string | null;
  imdbId: string | null;
  tmdbId: string | null;
}

export interface ParseResult {
  items: ParsedItem[];
  skipped: number;
  detectedFormat: string;
}

const ALIASES: Record<string, string[]> = {
  title: ["title", "pl_title", "tytul", "tytuł", "nazwa"],
  originalTitle: ["original_title", "originaltitle", "oryginalny_tytul", "oryginalnytytul"],
  year: ["year", "rok", "premiere_year"],
  rating: ["user_rating", "rating10", "rating", "ocena"],
  date: ["date", "watcheddate", "watched_at", "rated_at", "data", "iso_date", "timestamp"],
  comment: ["comment", "review", "recenzja", "komentarz", "notatka"],
  imdbId: ["imdb_id", "imdbid", "imdb"],
  tmdbId: ["tmdb_id", "tmdbid", "tmdb"],
  sourceId: ["movie_id", "filmweb_id", "id"],
  type: ["type", "kind", "typ"],
};

function normalizeHeader(h: string) {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

function pickValue(row: Record<string, unknown>, keys: string[]): string | null {
  const normalizedRow: Record<string, unknown> = {};
  for (const key of Object.keys(row)) {
    normalizedRow[normalizeHeader(key)] = row[key];
  }
  for (const alias of keys) {
    const value = normalizedRow[alias];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return null;
}

function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  // Unix timestamp (ms or s)
  if (/^\d{10,13}$/.test(raw)) {
    const num = Number(raw);
    const ms = raw.length === 13 ? num : num * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseRating(raw: string | null): number | null {
  if (!raw) return null;
  const num = Number(raw.replace(",", "."));
  if (Number.isNaN(num)) return null;
  // some exports use 0-10 already, others could be percentage-like; clamp to 1-10
  const rounded = Math.round(num);
  if (rounded < 1 || rounded > 10) return null;
  return rounded;
}

function rowsToItems(rows: Record<string, unknown>[]): { items: ParsedItem[]; skipped: number } {
  const items: ParsedItem[] = [];
  let skipped = 0;

  for (const row of rows) {
    const title = pickValue(row, ALIASES.title);
    if (!title) {
      skipped += 1;
      continue;
    }
    const originalTitle = pickValue(row, ALIASES.originalTitle);
    const yearRaw = pickValue(row, ALIASES.year);
    const year = yearRaw ? Number.parseInt(yearRaw, 10) : null;
    const rating = parseRating(pickValue(row, ALIASES.rating));
    const dateRaw = pickValue(row, ALIASES.date);
    const date = parseDate(dateRaw);
    const comment = pickValue(row, ALIASES.comment);
    const imdbId = pickValue(row, ALIASES.imdbId);
    const tmdbId = pickValue(row, ALIASES.tmdbId);
    const sourceId = pickValue(row, ALIASES.sourceId);
    const typeRaw = pickValue(row, ALIASES.type);
    const type: "movie" | "show" = typeRaw && /serial|show|series/i.test(typeRaw) ? "show" : "movie";

    items.push({
      title: originalTitle ? title : title,
      originalTitle: originalTitle ?? null,
      year: year && !Number.isNaN(year) ? year : null,
      type,
      userRating: rating,
      ratedAt: rating ? date : null,
      watchedAt: date,
      comment: comment ?? null,
      sourceId: sourceId ?? null,
      imdbId: imdbId ?? null,
      tmdbId: tmdbId ?? null,
    });
  }

  return { items, skipped };
}

export function parseFilmwebFile(filename: string, content: string): ParseResult {
  const isJson = filename.toLowerCase().endsWith(".json") || content.trim().startsWith("[") || content.trim().startsWith("{");

  if (isJson) {
    try {
      const data = JSON.parse(content);
      const rows: Record<string, unknown>[] = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : [];
      const { items, skipped } = rowsToItems(rows);
      return { items, skipped, detectedFormat: "json" };
    } catch {
      // fall through to CSV parsing attempt below
    }
  }

  const parsed = Papa.parse<Record<string, unknown>>(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  const { items, skipped } = rowsToItems(parsed.data);
  return {
    items,
    skipped: skipped + (parsed.errors?.length ?? 0),
    detectedFormat: "csv",
  };
}
