import { db } from "@/lib/db/client";
import { scraperRuns } from "@/lib/db/schema";
import { getAllScrapers } from "@/lib/scrapers/registry";
import { eq } from "drizzle-orm";

export async function POST() {
  const scrapers = getAllScrapers();
  const runs: { name: string; runId: number }[] = [];

  for (const scraper of scrapers) {
    const now = new Date().toISOString();
    const [run] = await db
      .insert(scraperRuns)
      .values({
        scraperName: scraper.config.name,
        startedAt: now,
        status: "running",
      })
      .returning({ id: scraperRuns.id });

    const runId = run.id;
    runs.push({ name: scraper.config.name, runId });

    // Fire scraper in background
    setTimeout(async () => {
      try {
        const result = await scraper.run();
        const combinedMessage =
          result.error ??
          (result.errors.length > 0
            ? result.errors.slice(0, 5).join(" | ") +
              (result.errors.length > 5
                ? ` (+${result.errors.length - 5} more)`
                : "")
            : null);

        await db
          .update(scraperRuns)
          .set({
            status: result.status,
            recordsFetched: result.recordsFetched,
            finishedAt: new Date().toISOString(),
            errorMessage: combinedMessage,
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
  }

  return Response.json({ status: "started", runs });
}
