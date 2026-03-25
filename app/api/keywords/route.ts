import { type NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { keywordScores } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const keyword = searchParams.get("keyword");
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") ?? "50")));

  const conditions = [];

  if (keyword) {
    conditions.push(eq(keywordScores.keyword, keyword));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: keywordScores.id,
      keyword: keywordScores.keyword,
      store: keywordScores.store,
      trafficScore: keywordScores.trafficScore,
      difficultyScore: keywordScores.difficultyScore,
      date: keywordScores.date,
      createdAt: keywordScores.createdAt,
    })
    .from(keywordScores)
    .where(whereClause)
    .orderBy(desc(keywordScores.date))
    .limit(limit);

  return Response.json(rows);
}
