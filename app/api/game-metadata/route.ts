import { type NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { gameMetadata } from "@/lib/db/schema";
import { eq, and, desc, like, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const source = searchParams.get("source");
  const name = searchParams.get("name");
  const search = searchParams.get("search");
  const genre = searchParams.get("genre");
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") ?? "50")));

  const conditions = [];

  if (source) {
    conditions.push(eq(gameMetadata.source, source));
  }
  if (name) {
    conditions.push(eq(gameMetadata.name, name));
  }
  if (search) {
    conditions.push(like(gameMetadata.name, `%${search}%`));
  }
  if (genre) {
    conditions.push(like(gameMetadata.genres, `%${genre}%`));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(gameMetadata)
    .where(whereClause)
    .orderBy(desc(gameMetadata.updatedAt))
    .limit(limit);

  // Also return unique genres for the filter dropdown
  const allGenres = await db
    .select({ genres: gameMetadata.genres })
    .from(gameMetadata)
    .where(sql`${gameMetadata.genres} IS NOT NULL AND ${gameMetadata.genres} != ''`);

  const genreSet = new Set<string>();
  for (const row of allGenres) {
    if (row.genres) {
      for (const g of row.genres.split(",")) {
        const trimmed = g.trim();
        if (trimmed) genreSet.add(trimmed);
      }
    }
  }

  return Response.json({
    data: rows,
    genres: [...genreSet].sort(),
  });
}
