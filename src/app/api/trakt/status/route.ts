import { getActiveTraktAccount, traktConfigured } from "@/lib/trakt";

export const dynamic = "force-dynamic";

export async function GET() {
  const configured = traktConfigured();
  const account = configured ? await getActiveTraktAccount() : null;
  return Response.json({
    configured,
    connected: Boolean(account),
    username: account?.traktUsername ?? null,
    connectedAt: account?.connectedAt ?? null,
  });
}
