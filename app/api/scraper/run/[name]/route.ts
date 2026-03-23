import { type NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { scraperRuns } from "@/lib/db/schema";
import { getScraper } from "@/lib/scrapers/registry";
import { eq } from "drizzle-orm";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  const scraper = getScraper(name);
  if (!scraper) {
    return Response.json(
      { error: `Scraper "${name}" not found` },
      { status: 404 }
    );
  }

  // Create scraper_runs entry with status "running"
  const now = new Date().toISOString();
  const [run] = await db
    .insert(scraperRuns)
    .values({
      scraperName: name,
      startedAt: now,
      status: "running",
    })
    .returning({ id: scraperRuns.id });

  const runId = run.id;

  // Fire scraper in background
  setTimeout(async () => {
    try {
      const result = await scraper.run();
      await db
        .update(scraperRuns)
        .set({
          status: result.status,
          recordsFetched: result.recordsFetched,
          finishedAt: new Date().toISOString(),
          errorMessage: result.error ?? null,
        })
        .where(eq(scraperRuns.id, runId));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await db
        .update(scraperRuns)
        .set({
          status: "error",
          finishedAt: new Date().toISOString(),
          errorMessage: msg,
        })
        .where(eq(scraperRuns.id, runId));
    }
  }, 0);

  return Response.json({ status: "started", runId, scraper: name });
}
