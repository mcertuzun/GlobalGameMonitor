import { BaseScraper, ScraperConfig, ScraperResult } from "@/lib/scrapers/base-scraper";
import { apps, adCreatives } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// ── Types ──────────────────────────────────────────────────────────────

export interface MetaAdEntry {
  storeId: string;
  platform: "meta";
  creativeType: string;
  creativeUrl: string;
  adCopy: string;
  headline: string;
  cta: string;
  firstSeen: string;
  isActive: boolean;
}

interface RawMetaAdResult {
  adId: string;
  pageId: string;
  pageName: string;
  adCreativeBody: string;
  adCreativeLinkTitle: string;
  adCreativeLinkCaption: string;
  adCreativeImageUrl: string;
  adStartDate: string;
  isActive: boolean;
}

// ── Parser ─────────────────────────────────────────────────────────────

export function parseMetaAdResult(
  raw: RawMetaAdResult,
  storeId: string
): MetaAdEntry {
  return {
    storeId,
    platform: "meta",
    creativeType: "image",
    creativeUrl: raw.adCreativeImageUrl,
    adCopy: raw.adCreativeBody,
    headline: raw.adCreativeLinkTitle,
    cta: raw.adCreativeLinkCaption,
    firstSeen: raw.adStartDate,
    isActive: raw.isActive,
  };
}

// ── Scraper (Stub for Sprint 1) ────────────────────────────────────────

export class MetaAdLibraryScraper extends BaseScraper<MetaAdEntry> {
  config: ScraperConfig = {
    name: "meta-ad-library",
    category: "ads",
    rateLimit: { requests: 2, perSeconds: 30 },
    retryCount: 2,
    timeout: 30000,
  };

  async fetch(): Promise<ScraperResult<MetaAdEntry>> {
    // Stub: Playwright-based scraping is needed for the Meta Ad Library.
    // This will be implemented in a future sprint.
    console.info(
      "[meta-ad-library] Stub scraper — Playwright is needed for full implementation."
    );

    return {
      source: this.config.name,
      fetchedAt: new Date(),
      records: [],
      errors: [],
    };
  }

  async store(records: MetaAdEntry[]): Promise<void> {
    const { db } = await import("@/lib/db/client");

    for (const entry of records) {
      // Find the app in DB
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

      // Also check appstore
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
