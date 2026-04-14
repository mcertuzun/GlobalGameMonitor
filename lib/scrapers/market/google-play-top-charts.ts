import { BaseScraper, ScraperConfig, ScraperResult } from "@/lib/scrapers/base-scraper";
import { apps, topCharts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getChartConfig } from "@/lib/settings/chart-config";

// ── Types ──────────────────────────────────────────────────────────────

export interface GooglePlayChartEntry {
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

// ── Scraper ────────────────────────────────────────────────────────────

const CHART_TYPE_TO_COLLECTION: Record<string, string> = {
  free: "TOP_FREE",
  paid: "TOP_PAID",
  grossing: "GROSSING",
};

export class GooglePlayTopChartsScraper extends BaseScraper<GooglePlayChartEntry> {
  config: ScraperConfig = {
    name: "google-play-top-charts",
    category: "market",
    rateLimit: { requests: 3, perSeconds: 10 },
    retryCount: 3,
    timeout: 30000,
  };

  async fetch(): Promise<ScraperResult<GooglePlayChartEntry>> {
    const gplayModule = require("google-play-scraper");
    const gplay = gplayModule.default || gplayModule;
    const allEntries: GooglePlayChartEntry[] = [];
    const errors: string[] = [];

    const cfg = await getChartConfig();
    const playCategory =
      cfg.category === "games" ? gplay.category.GAME : undefined;

    for (const country of cfg.countries) {
      for (const chartType of cfg.chartTypes) {
        const collectionId = CHART_TYPE_TO_COLLECTION[chartType];
        if (!collectionId) {
          errors.push(`Unknown chartType '${chartType}' — skipped`);
          continue;
        }

        try {
          await this.rateLimit();

          const results = await gplay.list({
            collection: gplay.collection[collectionId],
            category: playCategory,
            num: cfg.topN,
            country: country.toLowerCase(),
          });

          const entries: GooglePlayChartEntry[] = (results as Array<{
            appId: string;
            title: string;
            developer: string;
            icon: string;
            genre: string;
          }>).map((item, index) => ({
            store: "playstore" as const,
            country: country.toUpperCase(),
            category: cfg.category,
            chartType,
            rank: index + 1,
            storeId: item.appId,
            name: item.title,
            developer: item.developer,
            iconUrl: item.icon,
            genre: item.genre ?? "",
          }));

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

  async store(records: GooglePlayChartEntry[]): Promise<void> {
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
