import { db } from "@/db";
import { importBatches } from "@/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const batches = await db.select().from(importBatches).orderBy(desc(importBatches.createdAt));
  return Response.json({ batches });
}
