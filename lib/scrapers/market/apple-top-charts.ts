import { BaseScraper, ScraperConfig, ScraperResult } from "@/lib/scrapers/base-scraper";
import { apps, topCharts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getChartConfig } from "@/lib/settings/chart-config";

// ── Types ──────────────────────────────────────────────────────────────

export interface AppleChartEntry {
  store: "appstore";
  country: string;
  category: string;
  chartType: string;
  rank: number;
  storeId: string;
  name: string;
  developer: string;
  iconUrl: string;
  genre: string;
}

interface AppleRssResult {
  artistName: string;
  id: string;
  name: string;
  artworkUrl100: string;
  genres: { name: string }[];
  url: string;
}

interface AppleRssFeed {
  feed: {
    title?: string;
    results: AppleRssResult[];
  };
}

// ── Parser ─────────────────────────────────────────────────────────────

export function parseAppleRssResponse(
  data: AppleRssFeed,
  country: string,
  category: string,
  chartType: string
): AppleChartEntry[] {
  const results = data.feed.results ?? [];
  return results.map((item, index) => ({
    store: "appstore" as const,
    country,
    category,
    chartType,
    rank: index + 1,
    storeId: item.id,
    name: item.name,
    developer: item.artistName,
    iconUrl: item.artworkUrl100,
    genre: item.genres?.[0]?.name ?? "",
  }));
}

// ── Scraper ────────────────────────────────────────────────────────────

// Apple's marketing RSS caps out at 200 entries per feed. We keep scraper-level
// config flexible but clamp the URL call to this ceiling.
const APPLE_RSS_MAX = 200;

export class AppleTopChartsScraper extends BaseScraper<AppleChartEntry> {
  config: ScraperConfig = {
    name: "apple-top-charts",
    category: "market",
    rateLimit: { requests: 5, perSeconds: 10 },
    retryCount: 3,
    timeout: 15000,
  };

  async fetch(): Promise<ScraperResult<AppleChartEntry>> {
    const allEntries: AppleChartEntry[] = [];
    const errors: string[] = [];

    const cfg = await getChartConfig();
    const limit = Math.min(cfg.topN, APPLE_RSS_MAX);

    for (const country of cfg.countries) {
      const countryLower = country.toLowerCase();
      for (const chartType of cfg.chartTypes) {
        // Apple's URL uses the "top-<type>" format.
        const urlChartType = `top-${chartType}`;
        try {
          await this.rateLimit();

          const url = `https://rss.applemarketingtools.com/api/v2/${countryLower}/apps/${urlChartType}/${limit}/apps.json`;
          const response = await fetch(url, {
            signal: AbortSignal.timeout(this.config.timeout),
          });

          if (!response.ok) {
            errors.push(`HTTP ${response.status} for ${country}/${chartType}`);
            continue;
          }

          const data = await response.json();
          const entries = parseAppleRssResponse(
            data,
            country.toUpperCase(),
            cfg.category,
            chartType
          );
          allEntries.push(...entries);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`Error fetching ${country}/${chartType}: ${msg}`);
        }
      }
    }

    return {
      source: this.config.name,
      fetchedAt: new Date(),
      records: allEntries,
      errors,
    };
  }

  async store(records: AppleChartEntry[]): Promise<void> {
    const { db } = await import("@/lib/db/client");
    const today = new Date().toISOString().split("T")[0];

    for (const entry of records) {
      // Upsert app: insert or update existing
      const existing = await db
        .select()
        .from(apps)
        .where(and(eq(apps.store, entry.store), eq(apps.storeId, entry.storeId)))
        .limit(1);

      let appId: number;

      if (existing.length > 0) {
        appId = existing[0].id;
        await db
          .update(apps)
          .set({
            name: entry.name,
            developer: entry.developer,
            category: entry.genre,
            iconUrl: entry.iconUrl,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(apps.id, appId));
      } else {
        const inserted = await db
          .insert(apps)
          .values({
            store: entry.store,
            storeId: entry.storeId,
            name: entry.name,
            developer: entry.developer,
            category: entry.genre,
            iconUrl: entry.iconUrl,
          })
          .returning({ id: apps.id });
        appId = inserted[0].id;
      }

      // Insert top chart entry, skip duplicates
      try {
        await db.insert(topCharts).values({
          store: entry.store,
          country: entry.country,
          category: entry.category,
          chartType: entry.chartType,
          date: today,
          rank: entry.rank,
          appId,
        });
      } catch {
        // Skip duplicate entries (unique constraint violation)
      }
    }
  }
}
