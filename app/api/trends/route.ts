import { type NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { trendsData, apps } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const appId = searchParams.get("appId");
  const keyword = searchParams.get("keyword");
  const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit") ?? "100")));

  const conditions = [];

  if (appId) {
    const id = Number(appId);
    if (!isNaN(id)) {
      conditions.push(eq(trendsData.appId, id));
    }
  }
  if (keyword) {
    conditions.push(eq(trendsData.keyword, keyword));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: trendsData.id,
      appId: trendsData.appId,
      keyword: trendsData.keyword,
      region: trendsData.region,
      interestScore: trendsData.interestScore,
      date: trendsData.date,
      appName: apps.name,
    })
    .from(trendsData)
    .innerJoin(apps, eq(trendsData.appId, apps.id))
    .where(whereClause)
    .orderBy(desc(trendsData.date))
    .limit(limit);

  return Response.json(rows);
}
