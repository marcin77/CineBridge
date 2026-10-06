import { db } from "@/db";
import { importBatches, mediaItems } from "@/db/schema";
import { and, asc, count, eq, isNotNull, isNull, inArray, notInArray } from "drizzle-orm";
import { getSetting } from "@/lib/settings";
import {
  isObviousMismatch,
  fetchSeasonEpisodesPl,
  fetchSeasonMeta,
  findShowMatchByEpisodeTitles,
  findShowMatchBySeasonMetadata,
  KnownEpisode,
} from "@/lib/tmdb-episode-match";

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
  const tmdbApiKey: string = apiKey;

  const [batch] = await db
    .select()
    .from(importBatches)
    .where(eq(importBatches.id, id));
  if (!batch) {
    return Response.json({ error: "Nie znaleziono importu." }, { status: 404 });
  }

  const shows = await db
    .select({
      sourceId: mediaItems.sourceId,
      tmdbId: mediaItems.tmdbId,
      title: mediaItems.title,
      originalTitle: mediaItems.originalTitle,
    })
    .from(mediaItems)
    .where(
      and(
        eq(mediaItems.importBatchId, id),
        eq(mediaItems.type, "show"),
        isNotNull(mediaItems.tmdbId),
      ),
    );

  const showTmdbMap = new Map<string, string>();
  const showTitleMap = new Map<string, { title: string; originalTitle: string | null }>();
  for (const s of shows) {
    if (s.sourceId && s.tmdbId) {
      showTmdbMap.set(s.sourceId, s.tmdbId);
      showTitleMap.set(s.sourceId, { title: s.title, originalTitle: s.originalTitle });
    }
  }

  const parentSourceIds = Array.from(showTmdbMap.keys());

  // ── NOWE: policz i oznacz "osierocone" odcinki/sezony ───────────────────
  // Odcinki/sezony, których rodzic (show) NIE MA tmdb_id — nie da się ich
  // przetworzyć (nie wiadomo pod jakim show'em szukać). Bez tego znikały
  // ze statystyk całkowicie. Oznaczamy jako tmdbSearched=true + failed,
  // żeby UI pokazywał prawdziwy stan, zamiast ciszy.
  let orphanedBlocked = 0;
  if (parentSourceIds.length > 0) {
    const orphanedEpisodes = await db
      .select({ id: mediaItems.id })
      .from(mediaItems)
      .where(
        and(
          eq(mediaItems.importBatchId, id),
          inArray(mediaItems.type, ["episode", "season"]),
          eq(mediaItems.tmdbSearched, false),
          isNotNull(mediaItems.parentShowId),
          // parentShowId NIE JEST w liście dopasowanych shows
        ),
      );

    const orphanedIds = orphanedEpisodes
      .filter((row) => true) // placeholder — patrz niżej właściwe zapytanie
      .map((row) => row.id);

    void orphanedIds; // patrz komentarz niżej
  }
  // Właściwe zapytanie na "sierotki" (parent bez tmdb_id) — patrz punkt (D) niżej,
  // bo wymaga NOT IN zamiast IN, co lepiej zrobić osobnym query. Zobacz sekcję
  // "D) Zliczanie sierotek" poniżej tego bloku kodu.

  if (parentSourceIds.length === 0) {
    return Response.json({ updated: 0, failed: 0, remaining: 0 });
  }

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

  const seasonCache = new Map<
    string,
    { seasonId: string | null; episodeShowId: string; episodeSeasonNumber: number }
  >();

async function getSeasonMetadata(parentShowId: string, seasonNumber: number) {
  const [row] = await db
    .select({
      seasonTitle: mediaItems.seasonTitle,
      seasonYear: mediaItems.seasonYear,
      director: mediaItems.director,
    })
    .from(mediaItems)
    .where(
      and(
        eq(mediaItems.importBatchId, id),
        eq(mediaItems.type, "season"),
        eq(mediaItems.parentShowId, parentShowId),
        eq(mediaItems.seasonNumber, seasonNumber),
      ),
    )
    .limit(1);
  return row ?? null;
}

  
  async function getKnownEpisodesForSeason(
    parentShowId: string,
    seasonNumber: number,
  ): Promise<KnownEpisode[]> {
    const rows = await db
      .select({
        episodeNumber: mediaItems.episodeNumber,
        episodeTitle: mediaItems.episodeTitle,
      })
      .from(mediaItems)
      .where(
        and(
          eq(mediaItems.importBatchId, id),
          eq(mediaItems.type, "episode"),
          eq(mediaItems.parentShowId, parentShowId),
          eq(mediaItems.seasonNumber, seasonNumber),
        ),
      );

    return rows.filter((r): r is KnownEpisode => r.episodeNumber !== null);
  }

async function resolveSeason(parentShowId: string, seasonNumber: number) {
  const showTmdbId = showTmdbMap.get(parentShowId)!;
  const cacheKey = `${showTmdbId}:${seasonNumber}`;
  if (seasonCache.has(cacheKey)) return seasonCache.get(cacheKey)!;

  const known = await getKnownEpisodesForSeason(parentShowId, seasonNumber);
  const meta = await getSeasonMetadata(parentShowId, seasonNumber);

  let seasonId: string | null = null;
  let episodeShowId = showTmdbId;
  let episodeSeasonNumber = seasonNumber;

  const directMeta = await fetchSeasonMeta(tmdbApiKey, showTmdbId, seasonNumber);
  if (directMeta) {
    let valid = true;

    if (known.length > 0) {
      const tmdbEpisodes = await fetchSeasonEpisodesPl(tmdbApiKey, showTmdbId, seasonNumber);
      if (tmdbEpisodes && isObviousMismatch(tmdbEpisodes, known)) valid = false;
    } else if (meta?.seasonYear != null && directMeta.year != null) {
      if (Math.abs(directMeta.year - meta.seasonYear) > 1) {
        valid = false;
        console.log(`[resolveSeason] Odrzucam show=${showTmdbId} season=${seasonNumber}: TMDB rok=${directMeta.year} != Filmweb season_year=${meta.seasonYear}`);
      }
    }

    if (valid) seasonId = directMeta.id;
  }

  if (!seasonId) {
    const titles = showTitleMap.get(parentShowId);
    const queries = [meta?.seasonTitle, titles?.originalTitle, titles?.title].filter(
      (v, i, arr): v is string => !!v && arr.indexOf(v) === i,
    );
    const hasSpecificSeasonTitle =
      !!meta?.seasonTitle &&
      meta.seasonTitle !== titles?.title &&
      meta.seasonTitle !== titles?.originalTitle;

    const match = await findShowMatchBySeasonMetadata(
      tmdbApiKey, queries, 1, known, meta?.director ?? null, meta?.seasonYear ?? null,
      hasSpecificSeasonTitle,
    );

    if (match.showTmdbId) {
      const newMeta = await fetchSeasonMeta(tmdbApiKey, match.showTmdbId, 1);
      if (newMeta) {
        seasonId = newMeta.id;
        episodeShowId = match.showTmdbId;
        episodeSeasonNumber = 1;

        if (seasonNumber === 1 && match.showTmdbId !== showTmdbId) {
          await db.update(mediaItems)
            .set({ tmdbId: match.showTmdbId, updatedAt: new Date().toISOString() })
            .where(and(eq(mediaItems.importBatchId, id), eq(mediaItems.type, "show"), eq(mediaItems.sourceId, parentShowId)));
          showTmdbMap.set(parentShowId, match.showTmdbId);
          console.log(`[tmdb-episodes] Poprawiono show-level: ${showTmdbId} → ${match.showTmdbId}`);
        }
      }
    }
  }

const resolved = { seasonId, episodeShowId, episodeSeasonNumber };
seasonCache.set(cacheKey, resolved);

if (seasonId) {
  await db.update(mediaItems)
    .set({
      tmdbId: seasonId,
      seasonShowTmdbId: episodeShowId,
      seasonShowSeasonNumber: episodeSeasonNumber,
      updatedAt: new Date().toISOString(),
    })
    .where(and(
      eq(mediaItems.importBatchId, id),
      eq(mediaItems.type, "season"),
      eq(mediaItems.parentShowId, parentShowId),
      eq(mediaItems.seasonNumber, seasonNumber),
    ));
}

return resolved;
}

  // ── Odcinki: przetwarzanie z izolacją błędów per-item ───────────────────
  for (const ep of episodes) {
    try {
      if (!ep.parentShowId || ep.seasonNumber === null || ep.episodeNumber === null) {
        await db.update(mediaItems)
          .set({ tmdbSearched: true })
          .where(eq(mediaItems.id, ep.id));
        failed++;
        continue;
      }

      const parentShowId = String(ep.parentShowId);
      if (!showTmdbMap.has(parentShowId)) {
        await db.update(mediaItems)
          .set({ tmdbSearched: true })
          .where(eq(mediaItems.id, ep.id));
        failed++;
        continue;
      }

      const { episodeShowId, episodeSeasonNumber } = await resolveSeason(parentShowId, ep.seasonNumber);

      const epData = await fetchEpisodeData(tmdbApiKey, episodeShowId, episodeSeasonNumber, ep.episodeNumber);

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
    } catch (err) {
      console.error(`[tmdb-episodes] Błąd przy odcinku ${ep.id}:`, err);
      try {
        await db.update(mediaItems)
          .set({ tmdbSearched: true, updatedAt: new Date().toISOString() })
          .where(eq(mediaItems.id, ep.id));
      } catch {
        // trudno — spróbuje się jeszcze raz w kolejnym wywołaniu
      }
      failed++;
    }
  }

  // ── Sezony bez odcinków ──────────────────────────────────────────────────
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
    try {
      if (!season.parentShowId || season.seasonNumber === null) continue;

      const parentShowId = String(season.parentShowId);
      if (!showTmdbMap.has(parentShowId)) continue;

      const { seasonId } = await resolveSeason(parentShowId, season.seasonNumber);

      await db.update(mediaItems)
        .set({
          tmdbId: seasonId,
          tmdbSearched: true,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(mediaItems.id, season.id));

      if (seasonId) updated++;
      else failed++;
    } catch (err) {
      console.error(`[tmdb-episodes] Błąd przy sezonie ${season.id}:`, err);
      try {
        await db.update(mediaItems)
          .set({ tmdbSearched: true, updatedAt: new Date().toISOString() })
          .where(eq(mediaItems.id, season.id));
      } catch {
        // trudno
      }
      failed++;
    }
  }

  // ── D) Zliczanie "sierotek" — odcinki/sezony pod NIEDOPASOWANYM show'em ──
  // Oznacz je jako przetworzone (nie da się ich dopasować bez tmdb_id showa),
  // żeby nie znikały ze statystyk w nieskończoność. Jeśli show zostanie
  // później poprawnie dopasowany (np. po ponownym uruchomieniu tmdb-match),
  // trzeba będzie zresetować tmdb_searched dla jego dzieci — patrz uwaga niżej.
  const orphanedWhere = parentSourceIds.length > 0
    ? and(
        eq(mediaItems.importBatchId, id),
        inArray(mediaItems.type, ["episode", "season"]),
        eq(mediaItems.tmdbSearched, false),
        isNotNull(mediaItems.parentShowId),
        notInArray(mediaItems.parentShowId, parentSourceIds),
      )
    : and(
        eq(mediaItems.importBatchId, id),
        inArray(mediaItems.type, ["episode", "season"]),
        eq(mediaItems.tmdbSearched, false),
        isNotNull(mediaItems.parentShowId),
      );

  const orphaned = await db
    .select({ id: mediaItems.id })
    .from(mediaItems)
    .where(orphanedWhere);

  for (const row of orphaned) {
    await db.update(mediaItems)
      .set({ tmdbSearched: true, updatedAt: new Date().toISOString() })
      .where(eq(mediaItems.id, row.id));
    failed++;
  }

  const [{ value: remainingEpisodes }] = await db
    .select({ value: count() })
    .from(mediaItems)
    .where(
      and(
        eq(mediaItems.importBatchId, id),
        eq(mediaItems.type, "episode"),
        eq(mediaItems.tmdbSearched, false),
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
      ),
    );

  return Response.json({ updated, failed, remaining: remainingEpisodes + remainingSeasons });
}