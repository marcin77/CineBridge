import { searchTrakt, type TraktSearchResult } from "@/lib/trakt";

function normalizeTitle(title: string) {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export interface MatchOutcome {
  status: "matched" | "manual" | "unmatched";
  confidence: number;
  result: TraktSearchResult | null;
}

export async function findBestMatch(
  title: string,
  year: number | null,
  originalTitle?: string | null,
): Promise<MatchOutcome> {
  const results = await searchTrakt(title, year);
  if (results.length === 0 && originalTitle) {
    const altResults = await searchTrakt(originalTitle, year);
    return scoreResults(altResults, [title, originalTitle], year);
  }
  return scoreResults(results, [title, originalTitle ?? undefined].filter(Boolean) as string[], year);
}

function scoreResults(results: TraktSearchResult[], titles: string[], year: number | null): MatchOutcome {
  if (results.length === 0) {
    return { status: "unmatched", confidence: 0, result: null };
  }

  const normalizedTitles = titles.map(normalizeTitle);
  let best: { result: TraktSearchResult; confidence: number } | null = null;

  for (const result of results) {
    const normalizedResultTitle = normalizeTitle(result.title);
    const titleMatches = normalizedTitles.some((t) => t === normalizedResultTitle);
    const yearMatches = year && result.year ? Math.abs(result.year - year) <= 0 : false;
    const yearClose = year && result.year ? Math.abs(result.year - year) <= 1 : false;

    let confidence = Math.round(Math.min(result.score, 40));
    if (titleMatches && yearMatches) confidence = 100;
    else if (titleMatches && yearClose) confidence = 85;
    else if (titleMatches) confidence = 70;
    else if (yearMatches) confidence = 50;

    if (!best || confidence > best.confidence) {
      best = { result, confidence };
    }
  }

  if (!best) return { status: "unmatched", confidence: 0, result: null };

  const status: MatchOutcome["status"] = best.confidence >= 80 ? "matched" : best.confidence >= 40 ? "manual" : "unmatched";
  return { status, confidence: best.confidence, result: best.result };
}
