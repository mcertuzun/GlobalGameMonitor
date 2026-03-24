import { type NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { gameMetadata } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const source = searchParams.get("source");
  const name = searchParams.get("name");
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") ?? "50")));

  const conditions = [];

  if (source) {
    conditions.push(eq(gameMetadata.source, source));
  }
  if (name) {
    conditions.push(eq(gameMetadata.name, name));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(gameMetadata)
    .where(whereClause)
    .orderBy(desc(gameMetadata.updatedAt))
    .limit(limit);

  return Response.json(rows);
}
