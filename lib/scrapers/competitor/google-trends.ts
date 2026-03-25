import { BaseScraper, ScraperConfig, ScraperResult } from "@/lib/scrapers/base-scraper";
import { apps, trendsData, trendSignals } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// ── Types ──────────────────────────────────────────────────────────────

export interface TrendsTimelinePoint {
  time: string; // Unix timestamp as string
  value: number[];
}

export interface TrendsRecord {
  appId: number | null;
  keyword: string;
  region: string;
  interestScore: number;
  date: string;
}

// ── Genre Keywords ────────────────────────────────────────────────────

export const GENRE_KEYWORDS = [
  "idle game",
  "merge game",
  "tower defense game",
  "roguelike game",
  "cozy game",
  "puzzle game",
  "strategy game",
  "simulation game",
  "racing game",
  "rpg game",
];

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

export function parseMultiKeywordTrendsResult(
  keywords: string[],
  timelineData: TrendsTimelinePoint[]
): Omit<TrendsRecord, "appId">[] {
  const records: Omit<TrendsRecord, "appId">[] = [];
  for (const point of timelineData) {
    for (let i = 0; i < keywords.length; i++) {
      records.push({
        keyword: keywords[i],
        region: "worldwide",
        interestScore: point.value[i] ?? 0,
        date: new Date(parseInt(point.time, 10) * 1000).toISOString(),
      });
    }
  }
  return records;
}

export interface RelatedQuery {
  query: string;
  value: number;
}

export function parseRelatedQueries(
  responseData: {
    default?: {
      rankedList?: Array<{
        rankedKeyword?: Array<{
          query: string;
          value: number;
        }>;
      }>;
    };
  }
): RelatedQuery[] {
  const lists = responseData?.default?.rankedList ?? [];
  // Second list is "rising", first is "top"
  const risingList = lists[1]?.rankedKeyword ?? lists[0]?.rankedKeyword ?? [];
  return risingList.map((item) => ({
    query: item.query,
    value: item.value,
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

    // ── Part A: Own game trends ─────────────────────────────────────
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

    // ── Part B: Genre keyword comparison ────────────────────────────
    // Google Trends allows max 5 keywords per call, so we split into 2 batches
    const batches = [
      GENRE_KEYWORDS.slice(0, 5),
      GENRE_KEYWORDS.slice(5, 10),
    ];

    const genreScores: Map<string, number> = new Map();

    for (const batch of batches) {
      try {
        await this.rateLimit();

        const response = await googleTrends.interestOverTime({
          keyword: batch,
          startTime,
        });

        const parsed = JSON.parse(response);
        const timelineData: TrendsTimelinePoint[] =
          parsed?.default?.timelineData ?? [];

        const records = parseMultiKeywordTrendsResult(batch, timelineData);
        for (const record of records) {
          allRecords.push({
            ...record,
            appId: null,
          });
          // Track the latest score per keyword
          const existing = genreScores.get(record.keyword) ?? 0;
          if (record.interestScore > existing) {
            genreScores.set(record.keyword, record.interestScore);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Error fetching genre trends batch: ${msg}`);
      }
    }

    // ── Part C: Related queries for top 3 genre keywords ────────────
    const sortedGenres = [...genreScores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    for (const [keyword] of sortedGenres) {
      try {
        await this.rateLimit();

        const response = await googleTrends.relatedQueries({
          keyword,
          startTime,
        });

        const parsed = JSON.parse(response);
        const risingQueries = parseRelatedQueries(parsed);

        // Store rising queries as trend signals
        const { db: dbClient } = await import("@/lib/db/client");
        const today = new Date().toISOString().split("T")[0];

        for (const rq of risingQueries.slice(0, 10)) {
          try {
            // Dedup check
            const existing = await dbClient
              .select({ id: trendSignals.id })
              .from(trendSignals)
              .where(
                and(
                  eq(trendSignals.source, "google-trends"),
                  eq(trendSignals.name, rq.query),
                  eq(trendSignals.date, today)
                )
              )
              .limit(1);

            if (existing.length === 0) {
              await dbClient.insert(trendSignals).values({
                source: "google-trends",
                signalType: "rising_query",
                name: rq.query,
                value: rq.value,
                metadata: JSON.stringify({ parentKeyword: keyword }),
                date: today,
              });
            }
          } catch {
            // Skip duplicate entries
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Error fetching related queries for "${keyword}": ${msg}`);
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
      // Dedup: skip if same keyword+date exists (for genre, appId is null)
      const dateStr = record.date.split("T")[0];

      if (record.appId != null) {
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
      } else {
        // For genre trends (appId=null), dedup by keyword+date
        const existing = await db
          .select({ id: trendsData.id })
          .from(trendsData)
          .where(
            and(
              eq(trendsData.keyword, record.keyword),
              eq(trendsData.date, dateStr)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          continue;
        }
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
