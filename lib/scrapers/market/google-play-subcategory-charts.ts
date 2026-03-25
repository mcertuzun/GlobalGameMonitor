import { BaseScraper, ScraperConfig, ScraperResult } from "@/lib/scrapers/base-scraper";
import { apps, topCharts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// ── Types ──────────────────────────────────────────────────────────────

export interface GooglePlaySubcategoryChartEntry {
  store: "playstore";
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

// ── Subcategories ─────────────────────────────────────────────────────

export const GAME_SUBCATEGORIES = [
  "GAME_ACTION",
  "GAME_ADVENTURE",
  "GAME_ARCADE",
  "GAME_CASUAL",
  "GAME_PUZZLE",
  "GAME_RACING",
  "GAME_ROLE_PLAYING",
  "GAME_SIMULATION",
  "GAME_SPORTS",
  "GAME_STRATEGY",
  "GAME_WORD",
];

// ── Parser ────────────────────────────────────────────────────────────

export function parseSubcategoryResults(
  results: Array<{
    appId: string;
    title: string;
    developer: string;
    icon: string;
    genre: string;
  }>,
  subcategory: string
): GooglePlaySubcategoryChartEntry[] {
  return results.map((item, index) => ({
    store: "playstore" as const,
    country: "US",
    category: subcategory,
    chartType: "free",
    rank: index + 1,
    storeId: item.appId,
    name: item.title,
    developer: item.developer,
    iconUrl: item.icon,
    genre: item.genre ?? "",
  }));
}

// ── Scraper ────────────────────────────────────────────────────────────

export class GooglePlaySubcategoryChartsScraper extends BaseScraper<GooglePlaySubcategoryChartEntry> {
  config: ScraperConfig = {
    name: "google-play-subcategory-charts",
    category: "market",
    rateLimit: { requests: 1, perSeconds: 3 },
    retryCount: 2,
    timeout: 30000,
  };

  async fetch(): Promise<ScraperResult<GooglePlaySubcategoryChartEntry>> {
    const gplayModule = require("google-play-scraper");
    const gplay = gplayModule.default || gplayModule;
    const allEntries: GooglePlaySubcategoryChartEntry[] = [];
    const errors: string[] = [];

    for (const subcategory of GAME_SUBCATEGORIES) {
      try {
        await this.rateLimit();

        const results = await gplay.list({
          collection: gplay.collection.TOP_FREE,
          category: gplay.category[subcategory],
          num: 20,
          country: "us",
        });

        const entries = parseSubcategoryResults(results, subcategory);
        allEntries.push(...entries);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Error fetching subcategory ${subcategory}: ${msg}`);
      }
    }

    return {
      source: this.config.name,
      fetchedAt: new Date(),
      records: allEntries,
      errors,
    };
  }

  async store(records: GooglePlaySubcategoryChartEntry[]): Promise<void> {
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
