import { db } from "@/db";
import { traktAccounts } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function POST() {
  await db.delete(traktAccounts);
  return Response.json({ ok: true });
}
