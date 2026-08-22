import { searchTmdb } from "@/lib/tmdb";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await searchTmdb("Inception", 2010, "movie");
  if (!result) {
    return Response.json({ ok: false, error: "Brak klucza API lub błąd połączenia." }, { status: 400 });
  }
  return Response.json({ ok: true, result });
}