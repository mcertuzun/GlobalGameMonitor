import { BaseScraper, ScraperConfig, ScraperResult } from "@/lib/scrapers/base-scraper";
import { apps, marketSnapshots } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// ── Types ──────────────────────────────────────────────────────────────

export interface AppleAppDetail {
  storeId: string;
  name: string;
  developer: string;
  category: string;
  rating: number;
  ratingCount: number;
  price: number;
  version: string;
  iconUrl: string;
}

interface ItunesResult {
  trackId: number;
  trackName: string;
  artistName: string;
  primaryGenreName: string;
  averageUserRating: number;
  userRatingCount: number;
  price: number;
  version: string;
  artworkUrl100: string;
  description?: string;
}

interface ItunesLookupResponse {
  resultCount: number;
  results: ItunesResult[];
}

// ── Parser ─────────────────────────────────────────────────────────────

export function parseItunesLookupResponse(
  data: ItunesLookupResponse
): AppleAppDetail | null {
  if (data.resultCount === 0 || data.results.length === 0) {
    return null;
  }

  const item = data.results[0];
  return {
    storeId: String(item.trackId),
    name: item.trackName,
    developer: item.artistName,
    category: item.primaryGenreName,
    rating: item.averageUserRating,
    ratingCount: item.userRatingCount,
    price: item.price,
    version: item.version,
    iconUrl: item.artworkUrl100,
  };
}

// ── Scraper ────────────────────────────────────────────────────────────

export class AppleAppDetailScraper extends BaseScraper<AppleAppDetail> {
  config: ScraperConfig = {
    name: "apple-app-detail",
    category: "market",
    rateLimit: { requests: 10, perSeconds: 60 },
    retryCount: 3,
    timeout: 10000,
  };

  async fetch(): Promise<ScraperResult<AppleAppDetail>> {
    const { db } = await import("@/lib/db/client");
    const allDetails: AppleAppDetail[] = [];
    const errors: string[] = [];

    // Get all tracked apps with store "appstore"
    const trackedApps = await db
      .select()
      .from(apps)
      .where(eq(apps.store, "appstore"));

    for (const app of trackedApps) {
      try {
        await this.rateLimit();

        const url = `https://itunes.apple.com/lookup?id=${app.storeId}`;
        const response = await fetch(url, {
          signal: AbortSignal.timeout(this.config.timeout),
        });

        if (!response.ok) {
          errors.push(`HTTP ${response.status} for app ${app.storeId}`);
          continue;
        }

        const data = await response.json();
        const detail = parseItunesLookupResponse(data);

        if (detail) {
          allDetails.push(detail);
        } else {
          errors.push(`No results for app ${app.storeId}`);
        }
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

  async store(records: AppleAppDetail[]): Promise<void> {
    const { db } = await import("@/lib/db/client");
    const today = new Date().toISOString().split("T")[0];

    for (const detail of records) {
      // Find the app in DB
      const existing = await db
        .select()
        .from(apps)
        .where(
          and(eq(apps.store, "appstore"), eq(apps.storeId, detail.storeId))
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

      // Insert market snapshot
      await db.insert(marketSnapshots).values({
        appId,
        source: "itunes-api",
        date: today,
        rating: detail.rating,
        ratingCount: detail.ratingCount,
        price: detail.price,
        version: detail.version,
      });
    }
  }
}
