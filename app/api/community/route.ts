import { type NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { communitySignals, apps } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const source = searchParams.get("source");
  const appId = searchParams.get("appId");
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") ?? "50")));

  const conditions = [];

  if (source) {
    conditions.push(eq(communitySignals.source, source));
  }
  if (appId) {
    const id = Number(appId);
    if (!isNaN(id)) {
      conditions.push(eq(communitySignals.appId, id));
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: communitySignals.id,
      appId: communitySignals.appId,
      source: communitySignals.source,
      title: communitySignals.title,
      url: communitySignals.url,
      contentSummary: communitySignals.contentSummary,
      sentimentScore: communitySignals.sentimentScore,
      engagementScore: communitySignals.engagementScore,
      date: communitySignals.date,
      appName: apps.name,
    })
    .from(communitySignals)
    .leftJoin(apps, eq(communitySignals.appId, apps.id))
    .where(whereClause)
    .orderBy(desc(communitySignals.date))
    .limit(limit);

  return Response.json(rows);
}
