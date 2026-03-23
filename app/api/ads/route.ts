import { type NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { adCreatives, apps } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const platform = searchParams.get("platform");
  const appId = searchParams.get("appId");
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") ?? "50")));

  const conditions = [];

  if (platform) {
    conditions.push(eq(adCreatives.platform, platform));
  }
  if (appId) {
    const id = Number(appId);
    if (!isNaN(id)) {
      conditions.push(eq(adCreatives.appId, id));
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: adCreatives.id,
      appId: adCreatives.appId,
      platform: adCreatives.platform,
      creativeType: adCreatives.creativeType,
      creativeUrl: adCreatives.creativeUrl,
      adCopy: adCreatives.adCopy,
      headline: adCreatives.headline,
      cta: adCreatives.cta,
      firstSeen: adCreatives.firstSeen,
      lastSeen: adCreatives.lastSeen,
      isActive: adCreatives.isActive,
      createdAt: adCreatives.createdAt,
      appName: apps.name,
      appIcon: apps.iconUrl,
    })
    .from(adCreatives)
    .innerJoin(apps, eq(adCreatives.appId, apps.id))
    .where(whereClause)
    .orderBy(desc(adCreatives.createdAt))
    .limit(limit);

  return Response.json(rows);
}
