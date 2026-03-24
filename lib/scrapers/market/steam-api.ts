import { BaseScraper, ScraperConfig, ScraperResult } from "@/lib/scrapers/base-scraper";
import { apps, marketSnapshots } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// ── Types ──────────────────────────────────────────────────────────────

export interface SteamStoreAppDetail {
  storeId: string;
  name: string;
  developer: string | undefined;
  category: string | undefined;
  rating: number | null;
  price: number;
  iconUrl: string;
  version: string;
}

interface SteamStoreRawData {
  steam_appid: number;
  name: string;
  developers?: string[];
  publishers?: string[];
  genres?: { id: string; description: string }[];
  metacritic?: { score: number; url: string };
  price_overview?: {
    currency: string;
    initial: number;
    final: number;
    discount_percent: number;
    initial_formatted: string;
    final_formatted: string;
  };
  header_image: string;
  short_description: string;
}

// ── Parser ─────────────────────────────────────────────────────────────

export function parseSteamStoreApp(data: SteamStoreRawData): SteamStoreAppDetail {
  return {
    storeId: String(data.steam_appid),
    name: data.name,
    developer: data.developers?.[0],
    category: data.genres?.[0]?.description,
    rating: data.metacritic?.score != null ? data.metacritic.score / 100 : null,
    price: data.price_overview?.final != null ? data.price_overview.final / 100 : 0,
    iconUrl: data.header_image,
    version: "",
  };
}

// ── Scraper ────────────────────────────────────────────────────────────

export class SteamApiScraper extends BaseScraper<SteamStoreAppDetail> {
  config: ScraperConfig = {
    name: "steam-api",
    category: "market",
    rateLimit: { requests: 1, perSeconds: 2 },
    retryCount: 2,
    timeout: 10000,
  };

  async fetch(): Promise<ScraperResult<SteamStoreAppDetail>> {
    const { db } = await import("@/lib/db/client");
    const allDetails: SteamStoreAppDetail[] = [];
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
          `https://store.steampowered.com/api/appdetails?appids=${app.storeId}`,
          { signal: AbortSignal.timeout(this.config.timeout) }
        );

        if (!response.ok) {
          errors.push(
            `Error fetching app ${app.storeId}: HTTP ${response.status}`
          );
          continue;
        }

        const json = await response.json();
        const appData = json[app.storeId];

        if (!appData?.success || !appData?.data) {
          errors.push(
            `Error fetching app ${app.storeId}: API returned unsuccessful`
          );
          continue;
        }

        const detail = parseSteamStoreApp(appData.data);
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

  async store(records: SteamStoreAppDetail[]): Promise<void> {
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
          category: detail.category,
          iconUrl: detail.iconUrl,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(apps.id, appId));

      // Insert market snapshot
      await db.insert(marketSnapshots).values({
        appId,
        source: "steam-api",
        date: today,
        rating: detail.rating,
        price: detail.price,
        version: detail.version,
      });
    }
  }
}
