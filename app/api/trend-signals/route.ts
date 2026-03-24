import { type NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { trendSignals } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const source = searchParams.get("source");
  const signalType = searchParams.get("signalType");
  const name = searchParams.get("name");
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") ?? "50")));

  const conditions = [];

  if (source) {
    conditions.push(eq(trendSignals.source, source));
  }
  if (signalType) {
    conditions.push(eq(trendSignals.signalType, signalType));
  }
  if (name) {
    conditions.push(eq(trendSignals.name, name));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(trendSignals)
    .where(whereClause)
    .orderBy(desc(trendSignals.createdAt))
    .limit(limit);

  return Response.json(rows);
}
