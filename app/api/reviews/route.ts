import { type NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { appReviews, apps } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const appId = searchParams.get("appId");
  const score = searchParams.get("score");
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") ?? "50")));

  const conditions = [];

  if (appId) {
    const id = Number(appId);
    if (!isNaN(id)) {
      conditions.push(eq(appReviews.appId, id));
    }
  }
  if (score) {
    const s = Number(score);
    if (!isNaN(s) && s >= 1 && s <= 5) {
      conditions.push(eq(appReviews.score, s));
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: appReviews.id,
      appId: appReviews.appId,
      store: appReviews.store,
      reviewId: appReviews.reviewId,
      userName: appReviews.userName,
      score: appReviews.score,
      title: appReviews.title,
      text: appReviews.text,
      thumbsUp: appReviews.thumbsUp,
      version: appReviews.version,
      date: appReviews.date,
      createdAt: appReviews.createdAt,
      appName: apps.name,
    })
    .from(appReviews)
    .innerJoin(apps, eq(appReviews.appId, apps.id))
    .where(whereClause)
    .orderBy(desc(appReviews.date))
    .limit(limit);

  return Response.json(rows);
}
