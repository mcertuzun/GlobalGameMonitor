import { db } from "@/lib/db/client";
import { marketSnapshots } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * Check if a market snapshot already exists for this app+source+date.
 */
export async function snapshotExistsForToday(
  appId: number,
  source: string
): Promise<boolean> {
  const today = new Date().toISOString().split("T")[0];
  const existing = await db
    .select({ id: marketSnapshots.id })
    .from(marketSnapshots)
    .where(
      and(
        eq(marketSnapshots.appId, appId),
        eq(marketSnapshots.source, source),
        eq(marketSnapshots.date, today)
      )
    )
    .limit(1);

  return existing.length > 0;
}
