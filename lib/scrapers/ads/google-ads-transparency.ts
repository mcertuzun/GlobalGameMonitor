import { BaseScraper, ScraperConfig, ScraperResult } from "@/lib/scrapers/base-scraper";
import { apps, adCreatives } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// ── Types ──────────────────────────────────────────────────────────────

export interface GoogleAdEntry {
  storeId: string;
  platform: "google";
  creativeType: string;
  creativeUrl: string;
  adCopy: string;
  headline: string;
  cta: string;
  firstSeen: string;
  isActive: boolean;
}

interface RawGoogleAdResult {
  adId: string;
  advertiserName: string;
  creativeContent: string;
  format: string;
  firstShown: string;
  lastShown: string;
  imageUrl: string;
}

// ── Parser ─────────────────────────────────────────────────────────────

export function parseGoogleAdResult(
  raw: RawGoogleAdResult,
  storeId: string
): GoogleAdEntry {
  return {
    storeId,
    platform: "google",
    creativeType: raw.format || "image",
    creativeUrl: raw.imageUrl,
    adCopy: raw.creativeContent,
    headline: raw.advertiserName,
    cta: "",
    firstSeen: raw.firstShown,
    isActive: true,
  };
}

// ── Scraper (Stub for Sprint 2) ────────────────────────────────────────

export class GoogleAdsTransparencyScraper extends BaseScraper<GoogleAdEntry> {
  config: ScraperConfig = {
    name: "google-ads-transparency",
    category: "ads",
    rateLimit: { requests: 2, perSeconds: 30 },
    retryCount: 2,
    timeout: 30000,
  };

  async fetch(): Promise<ScraperResult<GoogleAdEntry>> {
    // Stub: Requires Playwright for full scraping of Google Ads Transparency Center.
    console.info(
      "[google-ads-transparency] Stub scraper — Requires Playwright for full scraping."
    );

    return {
      source: this.config.name,
      fetchedAt: new Date(),
      records: [],
      errors: [],
    };
  }

  async store(records: GoogleAdEntry[]): Promise<void> {
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
