import { BaseScraper, ScraperConfig, ScraperResult } from "@/lib/scrapers/base-scraper";
import { apps, marketSnapshots } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { snapshotExistsForToday } from "@/lib/db/dedup";
import { SCRAPER_LIMITS } from "@/lib/config";

// ── Types ──────────────────────────────────────────────────────────────

export interface GooglePlayAppDetail {
  storeId: string;
  name: string;
  developer: string;
  category: string;
  rating: number;
  ratingCount: number;
  downloadsEstimate: number;
  price: number;
  version: string;
  iconUrl: string;
}

interface GPlayResult {
  appId: string;
  title: string;
  developer: string;
  genre: string;
  score: number;
  ratings: number;
  maxInstalls: number;
  free: boolean;
  price: number;
  version: string;
  icon: string;
}

// ── Parser ─────────────────────────────────────────────────────────────

export function parseGooglePlayApp(raw: GPlayResult): GooglePlayAppDetail {
  return {
    storeId: raw.appId,
    name: raw.title,
    developer: raw.developer,
    category: raw.genre,
    rating: raw.score,
    ratingCount: raw.ratings,
    downloadsEstimate: raw.maxInstalls,
    price: raw.free ? 0 : raw.price,
    version: raw.version,
    iconUrl: raw.icon,
  };
}

// ── Scraper ────────────────────────────────────────────────────────────

export class GooglePlayDetailScraper extends BaseScraper<GooglePlayAppDetail> {
  config: ScraperConfig = {
    name: "google-play-detail",
    category: "market",
    rateLimit: { requests: 5, perSeconds: 10 },
    retryCount: 3,
    timeout: 15000,
  };

  async fetch(): Promise<ScraperResult<GooglePlayAppDetail>> {
    const { db } = await import("@/lib/db/client");
    const gplayModule = require("google-play-scraper");
    const gplay = gplayModule.default || gplayModule;
    const allDetails: GooglePlayAppDetail[] = [];
    const errors: string[] = [];

    // Get all tracked apps with store "playstore"
    const trackedApps = await db
      .select()
      .from(apps)
      .where(eq(apps.store, "playstore"));

    for (const app of trackedApps) {
      try {
        await this.rateLimit();

        const result = await gplay.app({ appId: app.storeId });
        const detail = parseGooglePlayApp(result);
        allDetails.push(detail);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Error fetching app ${app.storeId}: ${msg}`);
      }
    }

    return {
      source: this.config.name,
      fetchedAt: new Date(),
      records: allDetails,
      errors,
    };
  }

  async store(records: GooglePlayAppDetail[]): Promise<void> {
    const { db } = await import("@/lib/db/client");
    const today = new Date().toISOString().split("T")[0];

    for (const detail of records) {
      // Find the app in DB
      const existing = await db
        .select()
        .from(apps)
        .where(
          and(eq(apps.store, "playstore"), eq(apps.storeId, detail.storeId))
        )
        .limit(1);

      if (existing.length === 0) {
        continue;
      }

      const appId = existing[0].id;

      // Update app info
      await db
        .update(apps)
        .set({
          name: detail.name,
          developer: detail.developer,
          category: detail.category,
          iconUrl: detail.iconUrl,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(apps.id, appId));

      // Insert market snapshot (skip if duplicate exists for today)
      if (SCRAPER_LIMITS.skipDuplicateSnapshots && await snapshotExistsForToday(appId, "google-play-scraper")) {
        continue;
      }

      await db.insert(marketSnapshots).values({
        appId,
        source: "google-play-scraper",
        date: today,
        rating: detail.rating,
        ratingCount: detail.ratingCount,
        downloadsEstimate: detail.downloadsEstimate,
        price: detail.price,
        version: detail.version,
      });
    }
  }
}
