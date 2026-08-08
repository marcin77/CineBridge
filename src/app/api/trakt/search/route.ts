import { searchTrakt, traktConfigured } from "@/lib/trakt";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!traktConfigured()) {
    return Response.json({ error: "Trakt nie jest skonfigurowany." }, { status: 400 });
  }
  const url = new URL(req.url);
  const query = url.searchParams.get("q");
  const year = url.searchParams.get("year");
  if (!query) return Response.json({ results: [] });

  const results = await searchTrakt(query, year ? Number(year) : null);
  return Response.json({ results });
}
