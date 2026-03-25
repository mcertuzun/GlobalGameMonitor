import { BaseScraper, ScraperConfig, ScraperResult } from "@/lib/scrapers/base-scraper";
import { apps, appReviews } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { SCRAPER_LIMITS } from "@/lib/config";

// ── Types ──────────────────────────────────────────────────────────────

export interface ParsedReview {
  appId: number;
  store: string;
  reviewId: string | null;
  userName: string | null;
  score: number;
  title: string | null;
  text: string | null;
  thumbsUp: number | null;
  version: string | null;
  date: string;
}

interface GPlayReviewRaw {
  id?: string;
  userName?: string;
  date?: string;
  score?: number;
  text?: string;
  thumbsUpCount?: number;
  version?: string | null;
}

interface AppStoreReviewRaw {
  id?: string;
  userName?: string;
  date?: string;
  score?: number;
  title?: string;
  text?: string;
  version?: string | null;
}

// ── Parsers ─────────────────────────────────────────────────────────────

export function parseGPlayReview(raw: GPlayReviewRaw): Omit<ParsedReview, "appId" | "store"> {
  return {
    reviewId: raw.id ?? null,
    userName: raw.userName ?? null,
    score: raw.score ?? 0,
    title: null,
    text: raw.text ?? null,
    thumbsUp: raw.thumbsUpCount ?? null,
    version: raw.version ?? null,
    date: raw.date ?? new Date().toISOString(),
  };
}

export function parseAppStoreReview(raw: AppStoreReviewRaw): Omit<ParsedReview, "appId" | "store"> {
  return {
    reviewId: raw.id ?? null,
    userName: raw.userName ?? null,
    score: raw.score ?? 0,
    title: raw.title ?? null,
    text: raw.text ?? null,
    thumbsUp: null,
    version: raw.version ?? null,
    date: raw.date ?? new Date().toISOString(),
  };
}

// ── Scraper ────────────────────────────────────────────────────────────

export class ReviewsScraper extends BaseScraper<ParsedReview> {
  config: ScraperConfig = {
    name: "reviews",
    category: "market",
    rateLimit: { requests: 1, perSeconds: 2 },
    retryCount: 2,
    timeout: 15000,
  };

  async fetch(): Promise<ScraperResult<ParsedReview>> {
    const { db } = await import("@/lib/db/client");
    const gplayModule = require("google-play-scraper");
    const gplay = gplayModule.default || gplayModule;
    const store = require("app-store-scraper");

    const allReviews: ParsedReview[] = [];
    const errors: string[] = [];

    // Get own games + first N apps
    const ownGames = await db
      .select()
      .from(apps)
      .where(eq(apps.isOwnGame, true));

    const otherApps = await db
      .select()
      .from(apps)
      .where(eq(apps.isOwnGame, false))
      .limit(SCRAPER_LIMITS.reviews.maxAppsToFetch);

    const trackedApps = [...ownGames, ...otherApps].slice(
      0,
      SCRAPER_LIMITS.reviews.maxAppsToFetch
    );

    // Fetch Google Play reviews
    for (const app of trackedApps.filter((a) => a.store === "playstore")) {
      try {
        await this.rateLimit();

        const result = await gplay.reviews({
          appId: app.storeId,
          sort: gplay.sort.HELPFULNESS,
          num: SCRAPER_LIMITS.reviews.maxReviewsPerApp,
        });

        const reviewData = result.data || result;
        const reviewList = Array.isArray(reviewData) ? reviewData : [];

        for (const raw of reviewList) {
          const parsed = parseGPlayReview(raw);
          allReviews.push({
            ...parsed,
            appId: app.id,
            store: "playstore",
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Error fetching Play Store reviews for ${app.storeId}: ${msg}`);
      }
    }

    // Fetch App Store reviews
    for (const app of trackedApps.filter((a) => a.store === "appstore")) {
      try {
        await this.rateLimit();

        const reviewList = await store.reviews({
          id: app.storeId,
          sort: store.sort.HELPFUL,
          page: 1,
        });

        const reviews = Array.isArray(reviewList) ? reviewList : [];

        for (const raw of reviews) {
          const parsed = parseAppStoreReview(raw);
          allReviews.push({
            ...parsed,
            appId: app.id,
            store: "appstore",
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Error fetching App Store reviews for ${app.storeId}: ${msg}`);
      }
    }

    return {
      source: this.config.name,
      fetchedAt: new Date(),
      records: allReviews,
      errors,
    };
  }

  async store(records: ParsedReview[]): Promise<void> {
    const { db } = await import("@/lib/db/client");

    for (const review of records) {
      // Skip if reviewId already exists for this app
      if (review.reviewId) {
        const existing = await db
          .select({ id: appReviews.id })
          .from(appReviews)
          .where(
            and(
              eq(appReviews.appId, review.appId),
              eq(appReviews.reviewId, review.reviewId)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          continue;
        }
      }

      await db.insert(appReviews).values({
        appId: review.appId,
        store: review.store,
        reviewId: review.reviewId,
        userName: review.userName,
        score: review.score,
        title: review.title,
        text: review.text,
        thumbsUp: review.thumbsUp,
        version: review.version,
        date: review.date,
      });
    }
  }
}
