import { BaseScraper, ScraperConfig, ScraperResult } from "@/lib/scrapers/base-scraper";
import { communitySignals } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import * as cheerio from "cheerio";

// ── Types ──────────────────────────────────────────────────────────────

export interface NewsRssItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
}

export interface NewsSignal {
  source: "news";
  title: string;
  url: string;
  contentSummary: string;
  sentimentScore: null;
  engagementScore: null;
  date: string;
}

// ── Parser ─────────────────────────────────────────────────────────────

export function parseNewsRssItem(item: NewsRssItem): NewsSignal {
  return {
    source: "news",
    title: item.title,
    url: item.link,
    contentSummary: item.description.slice(0, 200),
    sentimentScore: null,
    engagementScore: null,
    date: item.pubDate,
  };
}

// ── RSS Feed URLs ──────────────────────────────────────────────────────

const NEWS_FEED_URLS = [
  "https://www.pocketgamer.biz/feed/",
  "https://mobidictum.com/feed/",
];

// ── Scraper ────────────────────────────────────────────────────────────

export class NewsRssScraper extends BaseScraper<NewsSignal> {
  config: ScraperConfig = {
    name: "news-rss",
    category: "community",
    rateLimit: { requests: 1, perSeconds: 2 },
    retryCount: 2,
    timeout: 10000,
  };

  async fetch(): Promise<ScraperResult<NewsSignal>> {
    const allSignals: NewsSignal[] = [];
    const errors: string[] = [];

    for (const feedUrl of NEWS_FEED_URLS) {
      try {
        await this.rateLimit();

        const response = await fetch(feedUrl, {
          signal: AbortSignal.timeout(this.config.timeout),
          headers: {
            "User-Agent": "GlobalGameMonitor/1.0",
          },
        });

        if (!response.ok) {
          errors.push(
            `Error fetching RSS feed ${feedUrl}: HTTP ${response.status}`
          );
          continue;
        }

        const xml = await response.text();
        const $ = cheerio.load(xml, { xml: true });

        const items: NewsSignal[] = [];

        $("item").each((_i, el) => {
          if (items.length >= 20) return false; // Limit to 20 per feed

          const title = $(el).find("title").text();
          const link = $(el).find("link").text();
          const pubDate = $(el).find("pubDate").text() || new Date().toISOString();
          const description = $(el).find("description").text();

          const rssItem: NewsRssItem = { title, link, pubDate, description };
          items.push(parseNewsRssItem(rssItem));
        });

        allSignals.push(...items);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Error fetching RSS feed ${feedUrl}: ${msg}`);
      }
    }

    return {
      source: this.config.name,
      fetchedAt: new Date(),
      records: allSignals,
      errors,
    };
  }

  async store(records: NewsSignal[]): Promise<void> {
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

      // News items are not tied to a specific app
      await db.insert(communitySignals).values({
        appId: null,
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
