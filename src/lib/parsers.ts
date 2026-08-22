import Papa from "papaparse";

export interface ParsedItem {
  title: string;
  originalTitle: string | null;
  year: number | null;
  director: string | null; // <- DODANE
  type: "movie" | "show";
  userRating: number | null;
  ratedAt: string | null;
  watchedAt: string | null;
  comment: string | null;
  sourceId: string | null;
  imdbId: string | null;
  tmdbId: string | null;
  listName: string | null;
  listId: string | null;
  listStatus: string | null;
  favorite: string | null;
  category: string;
}

export interface ParseResult {
  items: ParsedItem[];
  skipped: number;
  detectedFormat: string;
}

// Column aliases – add more here if Filmweb changes its CSV headers
const ALIASES: Record<string, string[]> = {
  title:         ["title", "pl_title", "tytul", "tytuł", "nazwa", "film", "serial"],
  originalTitle: ["original_title", "originaltitle", "oryginalny_tytul", "oryginalnytytul"],
  year:          ["year", "rok", "premiere_year"],
  director:      ["director", "directors", "rezyser", "režyser", "reżyser"], // <- DODANE
  rating:        ["user_rating", "rating10", "rating", "ocena", "vote", "vote10"],
  date:          ["date", "watcheddate", "watched_at", "rated_at", "data", "iso_date", "timestamp", "ratedate", "viewdate"],
  comment:       ["comment", "review", "recenzja", "komentarz", "notatka"],
  imdbId:        ["imdb_id", "imdbid", "imdb"],
  tmdbId:        ["tmdb_id", "tmdbid", "tmdb"],
  sourceId:      ["filmweb_id", "movie_id", "id", "source_id"],
  type:          ["type", "kind", "typ"],
  listName:      ["list_name", "lista", "list", "listname"],
  category:      ["category", "kategoria"],
  listId:        ["list_id", "listid"],
  listStatus:    ["list_status", "liststatus"],
  favorite:      ["favorite", "favourite", "ulubione", "fav"],
};

function normalizeHeader(h: string) {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

function pickValue(row: Record<string, string>, keys: string[]): string | null {
  const normalizedRow: Record<string, string> = {};
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

function parseDate(raw: string | null): string | null {
  if (!raw) return null;
  // Unix timestamp (ms lub s)
  if (/^\d{10,13}$/.test(raw)) {
    const num = Number(raw);
    const ms = raw.length === 13 ? num : num * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function parseRating(raw: string | null): number | null {
  if (!raw) return null;
  const num = Number(raw.replace(",", "."));
  if (Number.isNaN(num)) return null;
  const rounded = Math.round(num);
  if (rounded < 1 || rounded > 10) return null;
  return rounded;
}

function parseCategory(raw: string | null, listName: string | null): string {
  if (!raw) {
    if (listName && /watchlist|chcę|want/i.test(listName)) return "watchlist";
    if (listName && /ulubione|favorit/i.test(listName)) return "favorite";
    return "watched";
  }
  const v = raw.toLowerCase();
  if (v.includes("watchlist") || v.includes("chcę") || v.includes("want")) return "watchlist";
  if (v.includes("favorit") || v.includes("ulubion")) return "favorite";
  if (v === "list") return "list";
  return "watched";
}

function rowsToItems(rows: Record<string, string>[]): { items: ParsedItem[]; skipped: number } {
  const items: ParsedItem[] = [];
  let skipped = 0;

  for (const row of rows) {
    const title = pickValue(row, ALIASES.title);
    if (!title) { skipped += 1; continue; }

    const originalTitle = pickValue(row, ALIASES.originalTitle);
    const yearRaw       = pickValue(row, ALIASES.year);
    const year          = yearRaw ? Number.parseInt(yearRaw, 10) : null;
    const director      = pickValue(row, ALIASES.director); // <- DODANE
    const rating        = parseRating(pickValue(row, ALIASES.rating));
    const dateRaw       = pickValue(row, ALIASES.date);
    const date          = parseDate(dateRaw);
    const comment       = pickValue(row, ALIASES.comment);
    const imdbId        = pickValue(row, ALIASES.imdbId);
    const tmdbId        = pickValue(row, ALIASES.tmdbId);
    const sourceId      = pickValue(row, ALIASES.sourceId);
    const typeRaw       = pickValue(row, ALIASES.type);
    const listName      = pickValue(row, ALIASES.listName);
    const categoryRaw   = pickValue(row, ALIASES.category);
    const listId        = pickValue(row, ALIASES.listId);
    const listStatus    = pickValue(row, ALIASES.listStatus);
    const favoriteRaw   = pickValue(row, ALIASES.favorite);

    // Konwersja "tak"/"nie" na boolean w kategoriach
    const isFavorite = favoriteRaw && /tak|yes|true|1/i.test(favoriteRaw);

    const type: "movie" | "show" =
      typeRaw && /serial|show|series/i.test(typeRaw) ? "show" : "movie";

    const category = parseCategory(categoryRaw, listName);

    items.push({
      title,
      originalTitle: originalTitle ?? null,
      year: year && !Number.isNaN(year) ? year : null,
      director: director ?? null, // <- DODANE
      type,
      userRating: rating,
      ratedAt:  rating ? date : null,
      watchedAt: date,
      comment:  comment ?? null,
      sourceId: sourceId ?? null,
      imdbId:   imdbId ?? null,
      tmdbId:   tmdbId ?? null,
      listName: listName ?? null,
      category,
      listId: listId ?? null,
      listStatus: listStatus ?? null,
      favorite: favoriteRaw ?? null,
    });
  }
  return { items, skipped };
}

export function parseFilmwebFile(filename: string, content: string): ParseResult {
  const isJson =
    filename.toLowerCase().endsWith(".json") ||
    content.trim().startsWith("[") ||
    content.trim().startsWith("{");

  if (isJson) {
    try {
      const data = JSON.parse(content);
      const rows: Record<string, string>[] = Array.isArray(data)
        ? data
        : Array.isArray(data.items)
        ? data.items
        : [];
      const { items, skipped } = rowsToItems(rows);
      return { items, skipped, detectedFormat: "json" };
    } catch {
      // fall through
    }
  }

  const parsed = Papa.parse<Record<string, string>>(content, {
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