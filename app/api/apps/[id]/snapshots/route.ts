import { type NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { marketSnapshots } from "@/lib/db/schema";
import { eq, and, desc, gte, lte } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const appId = Number(id);

  if (isNaN(appId)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  const searchParams = request.nextUrl.searchParams;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const limit = Math.min(1000, Math.max(1, Number(searchParams.get("limit") ?? "100")));

  const conditions = [eq(marketSnapshots.appId, appId)];

  if (from) {
    conditions.push(gte(marketSnapshots.date, from));
  }
  if (to) {
    conditions.push(lte(marketSnapshots.date, to));
  }

  const rows = await db
    .select()
    .from(marketSnapshots)
    .where(and(...conditions))
    .orderBy(desc(marketSnapshots.date))
    .limit(limit);

  return Response.json(rows);
}
