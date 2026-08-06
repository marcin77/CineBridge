import { startDeviceCode, traktConfigured } from "@/lib/trakt";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!traktConfigured()) {
    return Response.json(
      { error: "Ustaw TRAKT_CLIENT_ID i TRAKT_CLIENT_SECRET w zmiennych środowiskowych." },
      { status: 400 },
    );
  }
  try {
    const data = await startDeviceCode();
    return Response.json(data);
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Nie udało się rozpocząć autoryzacji Trakt." }, { status: 500 });
  }
}
