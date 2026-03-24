import { BaseScraper, ScraperConfig, ScraperResult } from "@/lib/scrapers/base-scraper";
import { apps, marketSnapshots } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { snapshotExistsForToday } from "@/lib/db/dedup";
import { SCRAPER_LIMITS } from "@/lib/config";

// ── Types ──────────────────────────────────────────────────────────────

export interface SteamSpyAppDetail {
  storeId: string;
  name: string;
  developer: string;
  rating: number;
  ratingCount: number;
  downloadsEstimate: number;
  price: number;
  iconUrl: string;
}

interface SteamSpyRawResult {
  appid: number;
  name: string;
  developer: string;
  publisher: string;
  score_rank: string;
  positive: number;
  negative: number;
  owners: string;
  average_forever: number;
  price: number;
}

// ── Parser ─────────────────────────────────────────────────────────────

/**
 * Parse owners string like "1,000,000 .. 2,000,000" → take first number
 */
function parseOwnersString(owners: string): number {
  const firstPart = owners.split("..")[0].trim();
  const cleaned = firstPart.replace(/,/g, "");
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}

export function parseSteamSpyApp(data: SteamSpyRawResult): SteamSpyAppDetail {
  const total = data.positive + data.negative;
  const rating = total > 0 ? data.positive / total : 0;

  return {
    storeId: String(data.appid),
    name: data.name,
    developer: data.developer,
    rating,
    ratingCount: total,
    downloadsEstimate: parseOwnersString(data.owners),
    price: data.price / 100,
    iconUrl: "",
  };
}

// ── Scraper ────────────────────────────────────────────────────────────

export class SteamSpyScraper extends BaseScraper<SteamSpyAppDetail> {
  config: ScraperConfig = {
    name: "steamspy",
    category: "market",
    rateLimit: { requests: 1, perSeconds: 1 },
    retryCount: 2,
    timeout: 10000,
  };

  async fetch(): Promise<ScraperResult<SteamSpyAppDetail>> {
    const { db } = await import("@/lib/db/client");
    const allDetails: SteamSpyAppDetail[] = [];
    const errors: string[] = [];

    // Get all tracked apps with store "steam"
    const trackedApps = await db
      .select()
      .from(apps)
      .where(eq(apps.store, "steam"));

    for (const app of trackedApps) {
      try {
        await this.rateLimit();

        const response = await fetch(
          `https://steamspy.com/api.php?request=appdetails&appid=${app.storeId}`,
          { signal: AbortSignal.timeout(this.config.timeout) }
        );

        if (!response.ok) {
          errors.push(
            `Error fetching app ${app.storeId}: HTTP ${response.status}`
          );
          continue;
        }

        const data = await response.json();
        const detail = parseSteamSpyApp(data);
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

  async store(records: SteamSpyAppDetail[]): Promise<void> {
    const { db } = await import("@/lib/db/client");
    const today = new Date().toISOString().split("T")[0];

    for (const detail of records) {
      // Find the app in DB
      const existing = await db
        .select()
        .from(apps)
        .where(
          and(eq(apps.store, "steam"), eq(apps.storeId, detail.storeId))
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
          iconUrl: detail.iconUrl,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(apps.id, appId));

      // Insert market snapshot (skip if duplicate exists for today)
      if (SCRAPER_LIMITS.skipDuplicateSnapshots && await snapshotExistsForToday(appId, "steamspy")) {
        continue;
      }

      await db.insert(marketSnapshots).values({
        appId,
        source: "steamspy",
        date: today,
        rating: detail.rating,
        ratingCount: detail.ratingCount,
        downloadsEstimate: detail.downloadsEstimate,
        price: detail.price,
      });
    }
  }
}
