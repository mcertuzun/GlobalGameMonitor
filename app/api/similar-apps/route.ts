import { type NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { similarApps, apps } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const appId = searchParams.get("appId");
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") ?? "50")));

  const conditions = [];

  if (appId) {
    const id = Number(appId);
    if (!isNaN(id)) {
      conditions.push(eq(similarApps.appId, id));
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: similarApps.id,
      appId: similarApps.appId,
      similarStoreId: similarApps.similarStoreId,
      similarName: similarApps.similarName,
      similarDeveloper: similarApps.similarDeveloper,
      similarScore: similarApps.similarScore,
      store: similarApps.store,
      discoveredAt: similarApps.discoveredAt,
      appName: apps.name,
    })
    .from(similarApps)
    .innerJoin(apps, eq(similarApps.appId, apps.id))
    .where(whereClause)
    .orderBy(desc(similarApps.discoveredAt))
    .limit(limit);

  return Response.json(rows);
}
