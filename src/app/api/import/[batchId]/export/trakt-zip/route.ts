import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { importBatches, mediaItems } from "@/db/schema";
import { eq, asc, desc } from "drizzle-orm";
import JSZip from "jszip";

export const dynamic = "force-dynamic";

const CHUNK = 250; // tyle rekordów na plik ma prawdziwy eksport Trakt

type Item = typeof mediaItems.$inferSelect;

// ── helpers ───────────────────────────────────────────────────────────────
function iso(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function slugify(title: string, year: number | null): string {
  const base = title
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return year ? `${base}-${year}` : base;
}

function numOrNull(v: string | null): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function movieIds(i: Item) {
  return { trakt: null, slug: slugify(i.title, i.year), imdb: i.imdbId ?? null, tmdb: numOrNull(i.tmdbId) };
}

function showObj(i: Item) {
  return {
    title: i.title,
    year: i.year,
    ids: { trakt: null, slug: slugify(i.title, i.year), tvdb: null, imdb: i.imdbId ?? null, tmdb: numOrNull(i.tmdbId), tvrage: null },
  };
}

function movieObj(i: Item) {
  return { title: i.title, year: i.year, ids: movieIds(i) };
}

function chunked<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function addChunkedFiles(zip: JSZip, name: string, rows: unknown[]) {
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

  // Serial-rodzic po filmweb ID (sezony/odcinki dziedziczą imdb/tmdb/tytuł/rok)
  const showsBySourceId = new Map<string, Item>();
  for (const i of items) {
    if (i.type === "show" && i.sourceId) showsBySourceId.set(String(i.sourceId), i);
  }
  const parentOf = (i: Item): Item =>
    (i.parentShowId && showsBySourceId.get(String(i.parentShowId))) || i;

  const watched = (t: string) => items.filter(i => i.category === "watched" && i.type === t);
  const rated   = (t: string) => items.filter(i => i.userRating && i.type === t);

  // liczba ocenionych odcinków per serial (do plays w watched-shows)
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

  // ── zip ──
  const zip = new JSZip();
  addChunkedFiles(zip, "ratings-movies", ratingsMovies);
  zip.file("ratings-shows.json",    JSON.stringify(ratingsShows, null, 2));
  zip.file("ratings-seasons.json",  JSON.stringify(ratingsSeasons, null, 2));
  zip.file("ratings-episodes.json", JSON.stringify(ratingsEpisodes, null, 2));
  addChunkedFiles(zip, "watched-movies", watchedMovies);
  zip.file("watched-shows.json",    JSON.stringify(watchedShows, null, 2));
  zip.file("lists-watchlist.json",  JSON.stringify(watchlist, null, 2));

  for (const [key, listItems] of customLists) {
    const [listId, listName] = key.split("|");
    const slug = slugify(listName, null) || "lista";
    zip.file(
      `lists-list-${listId}-${slug}.json`,
      JSON.stringify(listItems.map((i, idx) => listEntry(i, idx + 1)), null, 2)
    );
  }

  const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
  const date = new Date().toISOString().slice(0, 10);
  const filename = `cinebridge-filmweb_trakt-format_export_${date}.zip`;

return new NextResponse(new Uint8Array(buf), {
  headers: {
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="${filename}"`,
  },
});
}