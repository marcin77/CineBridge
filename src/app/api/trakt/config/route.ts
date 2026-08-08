import { traktConfigured } from "@/lib/trakt";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ configured: traktConfigured() });
}
