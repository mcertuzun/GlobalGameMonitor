import { BaseScraper, ScraperConfig, ScraperResult } from "@/lib/scrapers/base-scraper";
import { apps, similarApps } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { SCRAPER_LIMITS } from "@/lib/config";

// ── Types ──────────────────────────────────────────────────────────────

export interface ParsedSimilarApp {
  appId: number;
  similarStoreId: string;
  similarName: string;
  similarDeveloper: string | null;
  similarScore: number | null;
  store: string;
}

interface GPlaySimilarRaw {
  appId?: string;
  title?: string;
  developer?: string;
  score?: number;
}

interface AppStoreSimilarRaw {
  id?: string | number;
  title?: string;
  developer?: string;
  score?: number;
}

// ── Parsers ─────────────────────────────────────────────────────────────

export function parseGPlaySimilar(raw: GPlaySimilarRaw): Omit<ParsedSimilarApp, "appId" | "store"> {
  return {
    similarStoreId: raw.appId ?? "",
    similarName: raw.title ?? "",
    similarDeveloper: raw.developer ?? null,
    similarScore: raw.score ?? null,
  };
}

export function parseAppStoreSimilar(raw: AppStoreSimilarRaw): Omit<ParsedSimilarApp, "appId" | "store"> {
  return {
    similarStoreId: String(raw.id ?? ""),
    similarName: raw.title ?? "",
    similarDeveloper: raw.developer ?? null,
    similarScore: raw.score ?? null,
  };
}

// ── Scraper ────────────────────────────────────────────────────────────

export class SimilarAppsScraper extends BaseScraper<ParsedSimilarApp> {
  config: ScraperConfig = {
    name: "similar-apps",
    category: "competitor",
    rateLimit: { requests: 1, perSeconds: 2 },
    retryCount: 2,
    timeout: 15000,
  };

  async fetch(): Promise<ScraperResult<ParsedSimilarApp>> {
    const { db } = await import("@/lib/db/client");
    const gplayModule = require("google-play-scraper");
    const gplay = gplayModule.default || gplayModule;
    const store = require("app-store-scraper");

    const allSimilar: ParsedSimilarApp[] = [];
    const errors: string[] = [];

    // Get own games + first 10 apps
    const ownGames = await db
      .select()
      .from(apps)
      .where(eq(apps.isOwnGame, true));

    const otherApps = await db
      .select()
      .from(apps)
      .where(eq(apps.isOwnGame, false))
      .limit(10);

    const trackedApps = [...ownGames, ...otherApps].slice(0, SCRAPER_LIMITS.reviews.maxAppsToFetch);

    // Fetch Google Play similar apps
    for (const app of trackedApps.filter((a) => a.store === "playstore")) {
      try {
        await this.rateLimit();

        const results = await gplay.similar({ appId: app.storeId });
        const resultList = Array.isArray(results) ? results : [];

        for (const raw of resultList) {
          const parsed = parseGPlaySimilar(raw);
          if (parsed.similarStoreId) {
            allSimilar.push({
              ...parsed,
              appId: app.id,
              store: "playstore",
            });
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Error fetching Play Store similar for ${app.storeId}: ${msg}`);
      }
    }

    // Fetch App Store similar apps
    for (const app of trackedApps.filter((a) => a.store === "appstore")) {
      try {
        await this.rateLimit();

        const results = await store.similar({ id: app.storeId });
        const resultList = Array.isArray(results) ? results : [];

        for (const raw of resultList) {
          const parsed = parseAppStoreSimilar(raw);
          if (parsed.similarStoreId) {
            allSimilar.push({
              ...parsed,
              appId: app.id,
              store: "appstore",
            });
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Error fetching App Store similar for ${app.storeId}: ${msg}`);
      }
    }

    return {
      source: this.config.name,
      fetchedAt: new Date(),
      records: allSimilar,
      errors,
    };
  }

  async store(records: ParsedSimilarApp[]): Promise<void> {
    const { db } = await import("@/lib/db/client");

    for (const record of records) {
      // Upsert: skip if appId+similarStoreId already exists (unique constraint)
      try {
        await db.insert(similarApps).values({
          appId: record.appId,
          similarStoreId: record.similarStoreId,
          similarName: record.similarName,
          similarDeveloper: record.similarDeveloper,
          similarScore: record.similarScore,
          store: record.store,
        });
      } catch (err) {
        // Unique constraint violation — skip duplicate
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("UNIQUE constraint")) {
          continue;
        }
        throw err;
      }
    }
  }
}
