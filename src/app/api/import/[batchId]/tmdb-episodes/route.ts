import { db } from "@/db";
import { importBatches, mediaItems } from "@/db/schema";
import { and, asc, count, eq, isNotNull, isNull, inArray } from "drizzle-orm";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

const CHUNK = 20;

async function fetchEpisodeData(
  apiKey: string,
  showTmdbId: string,
  seasonNumber: number,
  episodeNumber: number,
): Promise<{ title: string | null; tmdbId: string | null }> {
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/tv/${showTmdbId}/season/${seasonNumber}/episode/${episodeNumber}?language=en-US&api_key=${apiKey}`
    );
    if (!res.ok) return { title: null, tmdbId: null };
    const data = await res.json();
    return {
      title: (data.name as string) || null,
      tmdbId: data.id ? String(data.id) : null,
    };
  } catch {
    return { title: null, tmdbId: null };
  }
}

async function fetchSeasonTmdbId(
  apiKey: string,
  showTmdbId: string,
  seasonNumber: number,
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/tv/${showTmdbId}/season/${seasonNumber}?language=en-US&api_key=${apiKey}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.id ? String(data.id) : null;
  } catch {
    return null;
  }
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const { batchId } = await params;
  const id = Number(batchId);
  if (Number.isNaN(id)) {
    return Response.json({ error: "Invalid ID" }, { status: 400 });
  }

  const apiKey = await getSetting("tmdb_api_key");
  if (!apiKey) {
    return Response.json({ error: "Brak klucza TMDB API." }, { status: 400 });
  }

  const [batch] = await db
    .select()
    .from(importBatches)
    .where(eq(importBatches.id, id));
  if (!batch) {
    return Response.json({ error: "Nie znaleziono importu." }, { status: 404 });
  }

  // Seriale z tmdb_id dla tego batcha
  const shows = await db
    .select({ sourceId: mediaItems.sourceId, tmdbId: mediaItems.tmdbId })
    .from(mediaItems)
    .where(
      and(
        eq(mediaItems.importBatchId, id),
        eq(mediaItems.type, "show"),
        isNotNull(mediaItems.tmdbId),
      ),
    );

  if (shows.length === 0) {
    return Response.json({ updated: 0, failed: 0, remaining: 0 });
  }

  const showTmdbMap = new Map<string, string>();
  for (const s of shows) {
    if (s.sourceId && s.tmdbId) showTmdbMap.set(s.sourceId, s.tmdbId);
  }

  const parentSourceIds = Array.from(showTmdbMap.keys());

  const episodes = await db
    .select()
    .from(mediaItems)
    .where(
      and(
        eq(mediaItems.importBatchId, id),
        eq(mediaItems.type, "episode"),
        eq(mediaItems.tmdbSearched, false),
        inArray(mediaItems.parentShowId, parentSourceIds),
      ),
    )
    .orderBy(asc(mediaItems.id))
    .limit(CHUNK);

  let updated = 0;
  let failed = 0;

  // Cache ID sezonów — klucz: "showTmdbId:seasonNumber"
  const seasonTmdbIdCache = new Map<string, string | null>();

  for (const ep of episodes) {
    if (!ep.parentShowId || ep.seasonNumber === null || ep.episodeNumber === null) {
      await db.update(mediaItems)
        .set({ tmdbSearched: true })
        .where(eq(mediaItems.id, ep.id));
      failed++;
      continue;
    }

    const showTmdbId = showTmdbMap.get(String(ep.parentShowId));
    if (!showTmdbId) {
      await db.update(mediaItems)
        .set({ tmdbSearched: true })
        .where(eq(mediaItems.id, ep.id));
      failed++;
      continue;
    }

    // ID sezonu — pobierz raz na unikalną parę show+season
    const seasonCacheKey = `${showTmdbId}:${ep.seasonNumber}`;
    if (!seasonTmdbIdCache.has(seasonCacheKey)) {
      const seasonTmdbId = await fetchSeasonTmdbId(apiKey, showTmdbId, ep.seasonNumber);
      seasonTmdbIdCache.set(seasonCacheKey, seasonTmdbId);

      // Zapisz tmdb_id do rekordu sezonu jeśli jeszcze nie ma
      if (seasonTmdbId) {
        await db.update(mediaItems)
          .set({ tmdbId: seasonTmdbId, updatedAt: new Date().toISOString() })
          .where(
            and(
              eq(mediaItems.importBatchId, id),
              eq(mediaItems.type, "season"),
              eq(mediaItems.parentShowId, String(ep.parentShowId)),
              eq(mediaItems.seasonNumber, ep.seasonNumber),
              isNull(mediaItems.tmdbId),
            )
          );
      }
    }

    // Dane odcinka — tytuł + tmdb_id
    const epData = await fetchEpisodeData(apiKey, showTmdbId, ep.seasonNumber, ep.episodeNumber);

    await db.update(mediaItems)
  .set({
    episodeTitleEn: epData.title ?? null,
    tmdbId: epData.tmdbId,
    tmdbSearched: true,
    updatedAt: new Date().toISOString(),
  })
  .where(eq(mediaItems.id, ep.id));

    if (epData.title) updated++;
    else failed++;
  }

   // ── Sezony bez odcinków — zapisz tmdb_id bezpośrednio ──────────────────
   const seasonsWithoutEpisodes = await db
    .select()
    .from(mediaItems)
    .where(
      and(
        eq(mediaItems.importBatchId, id),
        eq(mediaItems.type, "season"),
        eq(mediaItems.tmdbSearched, false),
        inArray(mediaItems.parentShowId, parentSourceIds),
      ),
    );

  for (const season of seasonsWithoutEpisodes) {
    if (!season.parentShowId || season.seasonNumber === null) continue;

    const showTmdbId = showTmdbMap.get(String(season.parentShowId));
    if (!showTmdbId) continue;

    const seasonCacheKey = `${showTmdbId}:${season.seasonNumber}`;
    if (!seasonTmdbIdCache.has(seasonCacheKey)) {
      const seasonTmdbId = await fetchSeasonTmdbId(apiKey, showTmdbId, season.seasonNumber);
      seasonTmdbIdCache.set(seasonCacheKey, seasonTmdbId);
    }

     const seasonTmdbId = seasonTmdbIdCache.get(seasonCacheKey) ?? null;
    await db.update(mediaItems)
      .set({
        tmdbId: seasonTmdbId,
        tmdbSearched: true,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(mediaItems.id, season.id));
    
    if (seasonTmdbId) updated++;
    else failed++;
  }
  // ── koniec sezonów bez odcinków ─────────────────────────────────────────

  // Remaining — odcinki + sezony bez tmdb_id (po przetworzeniu)
  const [{ value: remainingEpisodes }] = await db
    .select({ value: count() })
    .from(mediaItems)
    .where(
      and(
        eq(mediaItems.importBatchId, id),
        eq(mediaItems.type, "episode"),
        eq(mediaItems.tmdbSearched, false),
        inArray(mediaItems.parentShowId, parentSourceIds),
      ),
    );

  const [{ value: remainingSeasons }] = await db
    .select({ value: count() })
    .from(mediaItems)
    .where(
      and(
        eq(mediaItems.importBatchId, id),
        eq(mediaItems.type, "season"),
        eq(mediaItems.tmdbSearched, false), 
        inArray(mediaItems.parentShowId, parentSourceIds),
      ),
    );

  return Response.json({ updated, failed, remaining: remainingEpisodes + remainingSeasons });
}