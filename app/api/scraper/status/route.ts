import { type NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { scraperRuns } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const runId = searchParams.get("runId");

  if (runId) {
    const id = Number(runId);
    if (isNaN(id)) {
      return Response.json({ error: "Invalid runId" }, { status: 400 });
    }

    const rows = await db
      .select()
      .from(scraperRuns)
      .where(eq(scraperRuns.id, id))
      .limit(1);

    if (rows.length === 0) {
      return Response.json({ error: "Run not found" }, { status: 404 });
    }

    return Response.json(rows[0]);
  }

  // Return latest 50 runs ordered by startedAt desc
  const rows = await db
    .select()
    .from(scraperRuns)
    .orderBy(desc(scraperRuns.startedAt))
    .limit(50);

  return Response.json(rows);
}
