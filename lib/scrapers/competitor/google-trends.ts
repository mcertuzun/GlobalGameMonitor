import { BaseScraper, ScraperConfig, ScraperResult } from "@/lib/scrapers/base-scraper";
import { apps, trendsData } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// ── Types ──────────────────────────────────────────────────────────────

export interface TrendsTimelinePoint {
  time: string; // Unix timestamp as string
  value: number[];
}

export interface TrendsRecord {
  appId: number;
  keyword: string;
  region: string;
  interestScore: number;
  date: string;
}

// ── Parser ─────────────────────────────────────────────────────────────

export function parseTrendsResult(
  keyword: string,
  timelineData: TrendsTimelinePoint[]
): Omit<TrendsRecord, "appId">[] {
  return timelineData.map((point) => ({
    keyword,
    region: "worldwide",
    interestScore: point.value[0] ?? 0,
    date: new Date(parseInt(point.time, 10) * 1000).toISOString(),
  }));
}

// ── Scraper ────────────────────────────────────────────────────────────

export class GoogleTrendsScraper extends BaseScraper<TrendsRecord> {
  config: ScraperConfig = {
    name: "google-trends",
    category: "competitor",
    rateLimit: { requests: 1, perSeconds: 5 },
    retryCount: 2,
    timeout: 15000,
  };

  async fetch(): Promise<ScraperResult<TrendsRecord>> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const googleTrends = require("google-trends-api");
    const { db } = await import("@/lib/db/client");
    const allRecords: TrendsRecord[] = [];
    const errors: string[] = [];

    // Get own games to track trends for
    const ownGames = await db
      .select()
      .from(apps)
      .where(eq(apps.isOwnGame, true));

    const startTime = new Date();
    startTime.setDate(startTime.getDate() - 30);

    for (const app of ownGames) {
      try {
        await this.rateLimit();

        const response = await googleTrends.interestOverTime({
          keyword: app.name,
          startTime,
        });

        const parsed = JSON.parse(response);
        const timelineData: TrendsTimelinePoint[] =
          parsed?.default?.timelineData ?? [];

        const records = parseTrendsResult(app.name, timelineData);
        for (const record of records) {
          allRecords.push({
            ...record,
            appId: app.id,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Error fetching Google Trends for "${app.name}": ${msg}`);
      }
    }

    return {
      source: this.config.name,
      fetchedAt: new Date(),
      records: allRecords,
      errors,
    };
  }

  async store(records: TrendsRecord[]): Promise<void> {
    const { db } = await import("@/lib/db/client");

    for (const record of records) {
      // Dedup: skip if same app+keyword+date exists
      const dateStr = record.date.split("T")[0];
      const existing = await db
        .select({ id: trendsData.id })
        .from(trendsData)
        .where(
          and(
            eq(trendsData.appId, record.appId),
            eq(trendsData.keyword, record.keyword),
            eq(trendsData.date, dateStr)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        continue;
      }

      await db.insert(trendsData).values({
        appId: record.appId,
        keyword: record.keyword,
        region: record.region,
        interestScore: record.interestScore,
        date: dateStr,
      });
    }
  }
}
