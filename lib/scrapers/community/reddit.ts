import { BaseScraper, ScraperConfig, ScraperResult } from "@/lib/scrapers/base-scraper";
import { apps, communitySignals } from "@/lib/db/schema";
import { eq, or } from "drizzle-orm";
import * as cheerio from "cheerio";
import { SCRAPER_LIMITS } from "@/lib/config";

// ── Types ──────────────────────────────────────────────────────────────

export interface RedditRssEntry {
  title: string;
  link: string;
  published: string;
  score: number;
}

export interface RedditSignal {
  appId: number;
  source: "reddit";
  title: string;
  url: string;
  contentSummary: string;
  sentimentScore: null;
  engagementScore: number;
  date: string;
}

// ── Parser ─────────────────────────────────────────────────────────────

export function parseRedditRssEntry(entry: RedditRssEntry): Omit<RedditSignal, "appId"> {
  return {
    source: "reddit",
    title: entry.title,
    url: entry.link,
    contentSummary: entry.title,
    sentimentScore: null,
    engagementScore: entry.score,
    date: entry.published,
  };
}

// ── RSS Subreddits ─────────────────────────────────────────────────────

const SUBREDDITS = ["AndroidGaming", "iosgaming"];

function buildRedditSearchUrl(subreddit: string, gameName: string): string {
  const encoded = encodeURIComponent(gameName);
  return `https://www.reddit.com/r/${subreddit}/search.rss?q=${encoded}&sort=new&restrict_sr=1&limit=10`;
}

// ── Scraper ────────────────────────────────────────────────────────────

export class RedditScraper extends BaseScraper<RedditSignal> {
  config: ScraperConfig = {
    name: "reddit",
    category: "community",
    rateLimit: { requests: 1, perSeconds: 2 },
    retryCount: 2,
    timeout: 10000,
  };

  async fetch(): Promise<ScraperResult<RedditSignal>> {
    const { db } = await import("@/lib/db/client");
    const allSignals: RedditSignal[] = [];
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

    const trackedApps = [...ownGames, ...otherApps].slice(0, SCRAPER_LIMITS.maxRedditApps);

    for (const app of trackedApps) {
      for (const subreddit of SUBREDDITS) {
        try {
          await this.rateLimit();

          const url = buildRedditSearchUrl(subreddit, app.name);
          const response = await fetch(url, {
            signal: AbortSignal.timeout(this.config.timeout),
            headers: {
              "User-Agent": "GlobalGameMonitor/1.0",
            },
          });

          if (!response.ok) {
            errors.push(
              `Error fetching Reddit r/${subreddit} for "${app.name}": HTTP ${response.status}`
            );
            continue;
          }

          const xml = await response.text();
          const $ = cheerio.load(xml, { xml: true });

          $("entry").each((_i, el) => {
            const title = $(el).find("title").text();
            const link = $(el).find("link").attr("href") || "";
            const published = $(el).find("updated").text() || new Date().toISOString();
            // Reddit RSS doesn't have score directly; default to 0
            const score = 0;

            const entry: RedditRssEntry = { title, link, published, score };
            const parsed = parseRedditRssEntry(entry);

            allSignals.push({
              ...parsed,
              appId: app.id,
            });
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(
            `Error fetching Reddit r/${subreddit} for "${app.name}": ${msg}`
          );
        }
      }
    }

    return {
      source: this.config.name,
      fetchedAt: new Date(),
      records: allSignals,
      errors,
    };
  }

  async store(records: RedditSignal[]): Promise<void> {
    const { db } = await import("@/lib/db/client");

    for (const signal of records) {
      // Dedup: skip if URL already exists
      const existing = await db
        .select({ id: communitySignals.id })
        .from(communitySignals)
        .where(eq(communitySignals.url, signal.url))
        .limit(1);

      if (existing.length > 0) {
        continue;
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
