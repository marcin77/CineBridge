import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { importBatches, mediaItems } from "@/db/schema";
import { eq, asc, desc } from "drizzle-orm";
import JSZip from "jszip";

export const dynamic = "force-dynamic";

const CHUNK = 250;

type Item = typeof mediaItems.$inferSelect;

// ── helpers ───────────────────────────────────────────────────────────────
function iso(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function slugify(title: string, year: number | null): string {
  const base = title
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0142/g, "l").replace(/\u0141/g, "L") // ł → l, Ł → L
    .replace(/\u00f8/g, "o").replace(/\u00d8/g, "O") // ø → o
    .replace(/\u00fe/g, "th")                         // þ → th
    .replace(/\u00df/g, "ss")                         // ß → ss
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return year ? `${base}-${year}` : base;
}

function numOrNull(v: string | null | undefined): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function movieIds(i: Item) {
  return {
    trakt: null,
    slug: slugify(bestTitle(i), i.matchedYear ?? i.year),
    imdb: i.imdbId ?? null,
    tmdb: numOrNull(i.tmdbId),
  };
}

function bestTitle(i: Item): string {
  const t = i.matchedTitle ?? i.originalTitle ?? i.title ?? "";
  return t.replace(/²/g, "2").replace(/³/g, "3").replace(/¹/g, "1");
}
function showObj(i: Item) {
  return {
    title: bestTitle(i),
    year: i.matchedYear ?? i.year,
    ids: { trakt: null, slug: slugify(bestTitle(i), i.matchedYear ?? i.year), tvdb: null, imdb: i.imdbId ?? null, tmdb: numOrNull(i.tmdbId), tvrage: null },
  };
}

function movieObj(i: Item) {
  return { title: bestTitle(i), year: i.matchedYear ?? i.year, ids: movieIds(i) };
}

function chunked<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function addChunkedFiles(zip: JSZip, name: string, rows: unknown[]) {
  if (rows.length === 0) {
    zip.file(`${name}.json`, "[]");
    return;
  }
  if (rows.length <= CHUNK) {
    zip.file(`${name}.json`, JSON.stringify(rows, null, 2));
    return;
  }
  chunked(rows, CHUNK).forEach((part, idx) => {
    zip.file(`${name}-${idx + 1}.json`, JSON.stringify(part, null, 2));
  });
}

// ── route ─────────────────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;
  const id = Number(batchId);
  if (Number.isNaN(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const [batch] = await db.select().from(importBatches).where(eq(importBatches.id, id));
  if (!batch) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const items = await db.select().from(mediaItems)
    .where(eq(mediaItems.importBatchId, id))
    .orderBy(desc(mediaItems.ratedAt), desc(mediaItems.watchedAt), asc(mediaItems.title));

  // Serial-rodzic po filmweb ID
  const showsBySourceId = new Map<string, Item>();
  for (const i of items) {
    if (i.type === "show" && i.sourceId) showsBySourceId.set(String(i.sourceId), i);
  }
  const parentOf = (i: Item): Item =>
    (i.parentShowId && showsBySourceId.get(String(i.parentShowId))) || i;

  const watched = (t: string) => items.filter(i => i.category === "watched" && i.type === t);
  const rated   = (t: string) => items.filter(i => i.userRating && i.type === t);

  // liczba odcinków per serial
  const episodeCount = new Map<string, number>();
  for (const e of items.filter(i => i.type === "episode" && i.parentShowId)) {
    const k = String(e.parentShowId);
    episodeCount.set(k, (episodeCount.get(k) ?? 0) + 1);
  }

  // ── ratings ──
  const ratingsMovies = rated("movie").map(i => ({
    rated_at: iso(i.ratedAt), rating: i.userRating, type: "movie", movie: movieObj(i),
  }));

  const ratingsShows = rated("show").map(i => ({
    rated_at: iso(i.ratedAt), rating: i.userRating, type: "show", show: showObj(i),
  }));

  const ratingsSeasons = rated("season").map(i => ({
    rated_at: iso(i.ratedAt), rating: i.userRating, type: "season",
    season: { number: i.seasonNumber, ids: { trakt: null, tvdb: null, tmdb: null, tvrage: null } },
    show: showObj(parentOf(i)),
  }));

  const ratingsEpisodes = rated("episode").map(i => ({
    rated_at: iso(i.ratedAt), rating: i.userRating, type: "episode",
    episode: {
      season: i.seasonNumber, number: i.episodeNumber, title: i.episodeTitle ?? null,
      ids: { trakt: null, tvdb: null, imdb: null, tmdb: null, tvrage: null },
    },
    show: showObj(parentOf(i)),
  }));

  // ── watched ──
  const watchedMovies = watched("movie").map(i => ({
    last_updated_at: iso(i.watchedAt ?? i.ratedAt),
    last_watched_at: iso(i.watchedAt ?? i.ratedAt),
    movie: movieObj(i),
    plays: 1,
  }));

  const watchedShows = watched("show").map(i => ({
    plays: Math.max(1, episodeCount.get(String(i.sourceId)) ?? 1),
    last_watched_at: iso(i.watchedAt ?? i.ratedAt),
    last_updated_at: iso(i.watchedAt ?? i.ratedAt),
    reset_at: null,
    show: showObj(i),
  }));

  // ── watched-history ──
  let historyIdCounter = 1;

  const historyMovies = watched("movie").map(i => ({
    id: historyIdCounter++,
    watched_at: iso(i.watchedAt ?? i.ratedAt),
    action: "watch",
    type: "movie",
    movie: movieObj(i),
  }));

  const historyEpisodes = watched("episode").map(i => {
    const parent = parentOf(i);
    return {
      id: historyIdCounter++,
      watched_at: iso(i.watchedAt ?? i.ratedAt),
      action: "watch",
      type: "episode",
      episode: {
        season: i.seasonNumber,
        number: i.episodeNumber,
        title: i.episodeTitle ?? null,
        ids: { trakt: null, tvdb: null, imdb: null, tmdb: null, tvrage: null },
      },
      show: showObj(parent),
    };
  });

  const watchedHistory = [...historyMovies, ...historyEpisodes]
    .filter(h => h.watched_at !== null)
    .sort((a, b) => new Date(b.watched_at!).getTime() - new Date(a.watched_at!).getTime());

  // ── favorites — POPRAWKA: favorite to kolumna, nie kategoria ──
  const favoriteEntry = (i: Item, rank: number) => ({
    type: i.type,
    ...(i.type === "movie" ? { movie: movieObj(i) } : { show: showObj(i) }),
    rank,
    id: i.id,
    listed_at: iso(i.watchedAt ?? i.ratedAt ?? i.createdAt),
    notes: null,
    my_rating: i.userRating ?? null,
  });

  const favorites = items
    .filter(i => i.favorite === "tak" && (i.type === "movie" || i.type === "show"))
    .map((i, idx) => favoriteEntry(i, idx + 1));

  // ── comments — POPRAWKA: sezon i odcinek mają prawdziwe komentarze ──
  const commentEntry = (i: Item) => {
    const parent = parentOf(i);
    const base = {
      comment: {
        id: i.id,
        comment: i.comment,
        spoiler: false,
        review: false,
        parent_id: 0,
        created_at: iso(i.ratedAt ?? i.watchedAt ?? i.createdAt),
        updated_at: iso(i.ratedAt ?? i.watchedAt ?? i.createdAt),
        replies: 0,
        likes: 0,
        user_rating: i.userRating ?? null,
        language: "pl",
      },
    };

    if (i.type === "movie")   return { type: "movie",   movie:   movieObj(i), ...base };
    if (i.type === "show")    return { type: "show",    show:    showObj(i),  ...base };
    if (i.type === "season")  return {
      type: "season",
      season: { number: i.seasonNumber, ids: { trakt: null, tvdb: null, tmdb: null, tvrage: null } },
      show: showObj(parent),
      ...base,
    };
    // episode
    return {
      type: "episode",
      episode: {
        season: i.seasonNumber, number: i.episodeNumber, title: i.episodeTitle ?? null,
        ids: { trakt: null, tvdb: null, imdb: null, tmdb: null, tvrage: null },
      },
      show: showObj(parent),
      ...base,
    };
  };

  const hasComment = (i: Item) => !!(i.comment && i.comment.trim() !== "");

  const commentsMovies   = items.filter(i => i.type === "movie"   && hasComment(i)).map(commentEntry);
  const commentsShows    = items.filter(i => i.type === "show"    && hasComment(i)).map(commentEntry);
  const commentsSeasons  = items.filter(i => i.type === "season"  && hasComment(i)).map(commentEntry);
  const commentsEpisodes = items.filter(i => i.type === "episode" && hasComment(i)).map(commentEntry);

  // ── lists ──
  const listEntry = (i: Item, rank: number) => ({
    type: i.type,
    ...(i.type === "movie" ? { movie: movieObj(i) } : { show: showObj(i) }),
    rank,
    id: i.id,
    listed_at: iso(i.watchedAt ?? i.ratedAt ?? i.createdAt),
    notes: i.comment || null,
    my_rating: i.userRating ?? null,
  });

  const watchlist = items
    .filter(i => i.category === "watchlist" && (i.type === "movie" || i.type === "show"))
    .map((i, idx) => listEntry(i, idx + 1));

  const customLists = new Map<string, Item[]>();
  for (const i of items) {
    if (i.category !== "list" || !i.listName) continue;
    if (i.type !== "movie" && i.type !== "show") continue;
    const key = `${i.listId ?? "0"}|${i.listName}`;
    if (!customLists.has(key)) customLists.set(key, []);
    customLists.get(key)!.push(i);
  }

  const now = new Date().toISOString();
  const listsManifest = Array.from(customLists.entries()).map(([key, listItems]) => {
    const [listIdRaw, listName] = key.split("|");
    const listId = Number(listIdRaw) || 0;
    return {
      name: listName,
      description: "",
      privacy: "private",
      share_link: null,
      type: "personal",
      display_numbers: false,
      allow_comments: true,
      sort_by: "rank",
      sort_how: "asc",
      created_at: now,
      updated_at: now,
      item_count: listItems.length,
      comment_count: 0,
      likes: 0,
      ids: { slug: slugify(listName, null) || "lista", trakt: listId || null },
    };
  });

  // ── zip ──
  const zip = new JSZip();

  addChunkedFiles(zip, "ratings-movies",   ratingsMovies);
  addChunkedFiles(zip, "ratings-shows",    ratingsShows);
  zip.file("ratings-seasons.json",         JSON.stringify(ratingsSeasons,  null, 2));
  zip.file("ratings-episodes.json",        JSON.stringify(ratingsEpisodes, null, 2));

  addChunkedFiles(zip, "watched-movies",   watchedMovies);
  zip.file("watched-shows.json",           JSON.stringify(watchedShows,    null, 2));
  addChunkedFiles(zip, "watched-history",  watchedHistory);

  zip.file("lists-watchlist.json",         JSON.stringify(watchlist,       null, 2));
  zip.file("lists-favorites.json",         JSON.stringify(favorites,       null, 2));
  zip.file("lists-lists.json",             JSON.stringify(listsManifest,   null, 2));

  for (const [key, listItems] of customLists) {
    const [listId, listName] = key.split("|");
    const slug = slugify(listName, null) || "lista";
    zip.file(
      `lists-list-${listId}-${slug}.json`,
      JSON.stringify(listItems.map((i, idx) => listEntry(i, idx + 1)), null, 2)
    );
  }

  addChunkedFiles(zip, "comments-movies",   commentsMovies);
  zip.file("comments-shows.json",           JSON.stringify(commentsShows,    null, 2));
  zip.file("comments-seasons.json",         JSON.stringify(commentsSeasons,  null, 2));
  zip.file("comments-episodes.json",        JSON.stringify(commentsEpisodes, null, 2));
  zip.file("comments-lists.json",           "[]");
  // hidden-* usunięte — Filmweb nie ma tej funkcji, pliki byłyby zawsze puste

  const buf = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const date = new Date().toISOString().slice(0, 10);
  const filename = `cinebridge-filmweb_trakt-format_export_${date}.zip`;

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}