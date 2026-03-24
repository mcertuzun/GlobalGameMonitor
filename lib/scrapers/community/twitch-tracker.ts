import { BaseScraper, ScraperConfig, ScraperResult } from "@/lib/scrapers/base-scraper";
import { communitySignals } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// ── Types ──────────────────────────────────────────────────────────────

export interface TwitchRawData {
  gameName: string;
  currentViewers: number;
  peakViewers: number;
  avgViewers: number;
  hoursWatched: number;
}

export interface TwitchSignal {
  appId: number;
  source: "twitch";
  title: string;
  url: string;
  contentSummary: string;
  sentimentScore: null;
  engagementScore: number;
  date: string;
}

// ── Parser ─────────────────────────────────────────────────────────────

export function parseTwitchData(raw: TwitchRawData): Omit<TwitchSignal, "appId" | "url"> {
  return {
    source: "twitch",
    title: raw.gameName,
    contentSummary: `Viewers: ${raw.currentViewers}, Peak: ${raw.peakViewers}`,
    sentimentScore: null,
    engagementScore: raw.currentViewers,
    date: new Date().toISOString(),
  };
}

// ── Scraper (Stub) ─────────────────────────────────────────────────────

export class TwitchTrackerScraper extends BaseScraper<TwitchSignal> {
  config: ScraperConfig = {
    name: "twitch-tracker",
    category: "community",
    rateLimit: { requests: 1, perSeconds: 3 },
    retryCount: 2,
    timeout: 10000,
  };

  async fetch(): Promise<ScraperResult<TwitchSignal>> {
    // Stub: requires Twitch API keys for full implementation
    console.info(
      "[twitch-tracker] Stub scraper — Requires Twitch API keys (TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET)"
    );

    return {
      source: this.config.name,
      fetchedAt: new Date(),
      records: [],
      errors: [],
    };
  }

  async store(records: TwitchSignal[]): Promise<void> {
    const { db } = await import("@/lib/db/client");

    for (const signal of records) {
      // Dedup: skip if URL already exists
      if (signal.url) {
        const existing = await db
          .select({ id: communitySignals.id })
          .from(communitySignals)
          .where(eq(communitySignals.url, signal.url))
          .limit(1);

        if (existing.length > 0) {
          continue;
        }
      }

      await db.insert(communitySignals).values({
        appId: signal.appId,
        source: signal.source,
        title: signal.title,
        url: signal.url,
        contentSummary: signal.contentSummary,
        sentimentScore: signal.sentimentScore,
        engagementScore: signal.engagementScore,
        date: signal.date,
      });
    }
  }
}
