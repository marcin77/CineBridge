import { getSetting, setSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const tmdbApiKey = await getSetting("tmdb_api_key");
  return Response.json({ tmdbApiKey: tmdbApiKey ? "••••••••" : null });
}

export async function POST(req: Request) {
  const body = await req.json();
  if (body.tmdbApiKey !== undefined) {
    if (body.tmdbApiKey === "") {
      await setSetting("tmdb_api_key", "");
    } else {
      await setSetting("tmdb_api_key", body.tmdbApiKey);
    }
  }
  return Response.json({ ok: true });
}