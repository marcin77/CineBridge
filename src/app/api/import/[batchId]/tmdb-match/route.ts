import { db } from "@/db";
import { importBatches, mediaItems, traktMatchCache } from "@/db/schema";
import { and, asc, count, eq, isNull, isNotNull, inArray } from "drizzle-orm";
import { searchTmdb } from "@/lib/tmdb";
import { getSetting } from "@/lib/settings";
import {
  fetchShowExternalIds,
  findShowMatchByEpisodeTitles,
  KnownEpisode,
} from "@/lib/tmdb-episode-match";

export const dynamic = "force-dynamic";

const CHUNK = 20;

function tmdbCacheKey(type: string, title: string, year: number | null): string {
  return `tmdb:${type}:${title.toLowerCase()}:${year ?? ""}`;
}

type TmdbMatchResult = Awaited<ReturnType<typeof searchTmdb>>;

/**
 * Wybiera sezon z największą liczbą znanych (niepustych) tytułów odcinków
 * dla danego serialu w tym batchu — najbardziej wiarygodny materiał
 * do weryfikacji dopasowania show-poziomu.
 */
async function pickValidationEpisodes(
  batchId: number,
  parentShowId: string | null,
): Promise<{ seasonNumber: number; episodes: KnownEpisode[] } | null> {
  if (!parentShowId) return null;

  const rows = await db
    .select({
      seasonNumber: mediaItems.seasonNumber,
      episodeNumber: mediaItems.episodeNumber,
      episodeTitle: mediaItems.episodeTitle,
    })
    .from(mediaItems)
    .where(
      and(
        eq(mediaItems.importBatchId, batchId),
        eq(mediaItems.type, "episode"),
        eq(mediaItems.parentShowId, parentShowId),
        isNotNull(mediaItems.episodeTitle),
      ),
    );

  if (rows.length === 0) return null;

  const bySeason = new Map<number, KnownEpisode[]>();
  for (const r of rows) {
    if (r.seasonNumber === null || r.episodeNumber === null) continue;
    const list = bySeason.get(r.seasonNumber) ?? [];
    list.push({ episodeNumber: r.episodeNumber, episodeTitle: r.episodeTitle });
    bySeason.set(r.seasonNumber, list);
  }
  if (bySeason.size === 0) return null;

  let best: { seasonNumber: number; episodes: KnownEpisode[] } | null = null;
  for (const [seasonNumber, eps] of bySeason.entries()) {
    if (
      !best ||
      eps.length > best.episodes.length ||
      (eps.length === best.episodes.length && seasonNumber < best.seasonNumber)
    ) {
      best = { seasonNumber, episodes: eps };
    }
  }
  return best;
}

/**
 * Uzupełnia dopasowanie show'a TYLKO gdy standardowe wyszukiwanie (już
 * uwzględniające dopasowanie po reżyserze) nic nie znalazło. NIGDY nie
 * nadpisuje istniejącego, poprawnego wyniku — próba weryfikacji przez
 * tytuły JEDNEGO sezonu jest zawodna z dwóch powodów:
 * 1) różnice w tłumaczeniach między Filmwebem a TMDB dają fałszywe
 *    odrzucenia poprawnych dopasowań (np. The Walking Dead),
 * 2) dla antologii żaden pojedynczy sezon nie reprezentuje całego serialu
 *    (nadpisanie prowadzi do jeszcze gorszego wyniku niż null).
 * Właściwa naprawa dopasowań per-sezon dzieje się w tmdb-episodes/route.ts,
 * niezależnie od tego jaki tmdb_id ostatecznie wylądował na poziomie show.
 */
async function verifyOrFixShowMatch(
  apiKey: string,
  batchId: number,
  item: { sourceId: string | null; title: string; originalTitle: string | null },
  candidate: TmdbMatchResult | null,
): Promise<TmdbMatchResult | null> {
  if (candidate) {
    // Już mamy dopasowanie (np. potwierdzone przez rok+reżysera) — ufamy mu.
    return candidate;
  }

  if (!item.sourceId) {
    return null;
  }

  // Brak dopasowania w ogóle — spróbuj znaleźć chociaż "kotwicę" przez
  // dopasowanie tytułów odcinków dowolnego znanego sezonu. To tylko
  // best-effort dla przypadków, gdzie standardowe wyszukiwanie zawiodło
  // całkowicie (np. bardzo nietypowy tytuł).
  const validation = await pickValidationEpisodes(batchId, item.sourceId);
  if (!validation) return null;

  const queries = [item.originalTitle, item.title].filter(
    (v, i, arr): v is string => !!v && arr.indexOf(v) === i,
  );

  const bySeasonNumber = await findShowMatchByEpisodeTitles(
    apiKey,
    queries,
    validation.seasonNumber,
    validation.episodes,
  );
  if (bySeasonNumber.showTmdbId) {
    const ext = await fetchShowExternalIds(apiKey, bySeasonNumber.showTmdbId);
    return {
      tmdbId: bySeasonNumber.showTmdbId,
      imdbId: ext.imdbId,
      title: item.title,
      originalTitle: item.title,
      year: null,
      type: "show",
    };
  }

  if (validation.seasonNumber !== 1) {
    const bySeasonOne = await findShowMatchByEpisodeTitles(
      apiKey,
      queries,
      1,
      validation.episodes,
    );
    if (bySeasonOne.showTmdbId) {
      const ext = await fetchShowExternalIds(apiKey, bySeasonOne.showTmdbId);
      return {
        tmdbId: bySeasonOne.showTmdbId,
        imdbId: ext.imdbId,
        title: item.title,
        originalTitle: item.title,
        year: null,
        type: "show",
      };
    }
  }

  return null;
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const apiKey = await getSetting("tmdb_api_key");
  if (!apiKey) {
    return Response.json(
      { error: "Brak klucza TMDB API. Dodaj go w Ustawieniach." },
      { status: 400 },
    );
  }
  const tmdbApiKey: string = apiKey;

  const { batchId } = await params;
  const id = Number(batchId);

  const [batch] = await db
    .select()
    .from(importBatches)
    .where(eq(importBatches.id, id));
  if (!batch) return Response.json({ error: "Nie znaleziono importu." }, { status: 404 });

  const items = await db
    .select()
    .from(mediaItems)
    .where(
      and(
        eq(mediaItems.importBatchId, id),
        isNull(mediaItems.imdbId),
        isNull(mediaItems.tmdbId),
        eq(mediaItems.tmdbSearched, false),
        inArray(mediaItems.type, ["movie", "show"]),
      ),
    )
    .orderBy(asc(mediaItems.id))
    .limit(CHUNK);

  let matched = 0;
  let failed  = 0;
  let fromCache = 0;

for (const item of items) {
  try {
    const cacheKey = tmdbCacheKey(item.type, item.title, item.year);

    const [cached] = await db
      .select()
      .from(traktMatchCache)
      .where(eq(traktMatchCache.cacheKey, cacheKey))
      .limit(1);

    let result: TmdbMatchResult | null = null;

    if (cached) {
      fromCache++;
      if (cached.tmdbId) {
        result = {
          tmdbId: cached.tmdbId,
          imdbId: cached.imdbId,
          title: cached.matchedTitle ?? item.title,
          originalTitle: cached.matchedTitle ?? item.title,
          year: cached.matchedYear,
          type: item.type as "movie" | "show",
        };
      }
    } else {
      result = await searchTmdb(
        item.title,
        item.year,
        item.type as "movie" | "show",
        item.originalTitle,
        item.director,
      );
    }

    if (item.type === "show") {
      result = await verifyOrFixShowMatch(tmdbApiKey, id, item, result);
    }

    await db
      .insert(traktMatchCache)
      .values({
        cacheKey,
        type: item.type,
        imdbId: result?.imdbId ?? null,
        tmdbId: result?.tmdbId ?? null,
        traktId: null,
        matchedTitle: result?.title ?? null,
        matchedYear: result?.year ?? null,
        confidence: result ? 100 : 0,
        score: null,
      })
      .onConflictDoUpdate({
        target: traktMatchCache.cacheKey,
        set: {
          imdbId: result?.imdbId ?? null,
          tmdbId: result?.tmdbId ?? null,
          matchedTitle: result?.title ?? null,
          matchedYear: result?.year ?? null,
          confidence: result ? 100 : 0,
        },
      });

    if (result) {
      await db
        .update(mediaItems)
        .set({
          tmdbId:       result.tmdbId,
          imdbId:       result.imdbId ?? null,
          matchedTitle: result.title,
          matchedYear:  result.year ?? item.year,
          tmdbSearched: true,
          updatedAt:    new Date().toISOString(),
        })
        .where(eq(mediaItems.id, item.id));
      matched++;
    } else {
      await db
        .update(mediaItems)
        .set({
          tmdbSearched: true,
          updatedAt:    new Date().toISOString(),
        })
        .where(eq(mediaItems.id, item.id));
      failed++;
    }
  } catch (err) {
    // Izolacja: błąd na jednym itemie NIE MOŻE ubić całego chunku.
    console.error(`[tmdb-match] Błąd przy item ${item.id} (${item.title}):`, err);
    try {
      await db
        .update(mediaItems)
        .set({ tmdbSearched: true, updatedAt: new Date().toISOString() })
        .where(eq(mediaItems.id, item.id));
    } catch {
      // Jeśli nawet to się nie uda — trudno, item zostanie ponowiony w kolejnym chunku.
    }
    failed++;
  }
}

  const [{ value: remaining }] = await db
    .select({ value: count() })
    .from(mediaItems)
    .where(
      and(
        eq(mediaItems.importBatchId, id),
        isNull(mediaItems.imdbId),
        isNull(mediaItems.tmdbId),
        eq(mediaItems.tmdbSearched, false),
        inArray(mediaItems.type, ["movie", "show"]),
      ),
    );

  return Response.json({ matched, failed, remaining, fromCache });
}