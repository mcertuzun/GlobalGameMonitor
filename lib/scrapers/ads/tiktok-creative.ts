import { BaseScraper, ScraperConfig, ScraperResult } from "@/lib/scrapers/base-scraper";
import { apps, adCreatives } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// ── Types ──────────────────────────────────────────────────────────────

export interface TikTokAdEntry {
  storeId: string;
  platform: "tiktok";
  creativeType: "video";
  creativeUrl: string;
  adCopy: string;
  headline: string;
  cta: string;
  firstSeen: string;
  isActive: boolean;
}

interface RawTikTokAdResult {
  adId: string;
  advertiserName: string;
  adText: string;
  videoUrl: string;
  thumbnailUrl: string;
  likes: number;
  firstSeen: string;
}

// ── Parser ─────────────────────────────────────────────────────────────

export function parseTikTokAdResult(
  raw: RawTikTokAdResult,
  storeId: string
): TikTokAdEntry {
  return {
    storeId,
    platform: "tiktok",
    creativeType: "video",
    creativeUrl: raw.videoUrl || raw.thumbnailUrl,
    adCopy: raw.adText,
    headline: raw.advertiserName,
    cta: "",
    firstSeen: raw.firstSeen,
    isActive: true,
  };
}

// ── Scraper (Stub for Sprint 2) ────────────────────────────────────────

export class TikTokCreativeScraper extends BaseScraper<TikTokAdEntry> {
  config: ScraperConfig = {
    name: "tiktok-creative",
    category: "ads",
    rateLimit: { requests: 2, perSeconds: 30 },
    retryCount: 2,
    timeout: 30000,
  };

  async fetch(): Promise<ScraperResult<TikTokAdEntry>> {
    // Stub: Requires Playwright for full scraping of TikTok Creative Center.
    console.info(
      "[tiktok-creative] Stub scraper — Requires Playwright for full scraping."
    );

    return {
      source: this.config.name,
      fetchedAt: new Date(),
      records: [],
      errors: [],
    };
  }

  async store(records: TikTokAdEntry[]): Promise<void> {
    const { db } = await import("@/lib/db/client");

    for (const entry of records) {
      // Find the app in DB — check playstore first, then appstore
      const existing = await db
        .select()
        .from(apps)
        .where(
          and(
            eq(apps.store, "playstore"),
            eq(apps.storeId, entry.storeId)
          )
        )
        .limit(1);

      const existingAppstore = existing.length > 0
        ? existing
        : await db
            .select()
            .from(apps)
            .where(
              and(
                eq(apps.store, "appstore"),
                eq(apps.storeId, entry.storeId)
              )
            )
            .limit(1);

      const matchedApp = existing.length > 0 ? existing : existingAppstore;

      if (matchedApp.length === 0) {
        continue;
      }

      const appId = matchedApp[0].id;

      await db.insert(adCreatives).values({
        appId,
        platform: entry.platform,
        creativeType: entry.creativeType,
        creativeUrl: entry.creativeUrl,
        adCopy: entry.adCopy,
        headline: entry.headline,
        cta: entry.cta,
        firstSeen: entry.firstSeen,
        isActive: entry.isActive,
      });
    }
  }
}
