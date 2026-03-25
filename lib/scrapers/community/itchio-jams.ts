import {
  BaseScraper,
  ScraperConfig,
  ScraperResult,
} from "@/lib/scrapers/base-scraper";
import { trendSignals } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import * as cheerio from "cheerio";

// ── Types ──────────────────────────────────────────────────────────────

export interface ItchioRssEntry {
  title: string;
  link: string;
  published: string;
  description: string;
}

export interface ItchioSignal {
  source: "itchio-jams";
  signalType: "trending" | "jam_theme";
  name: string;
  value: null;
  metadata: string;
  date: string;
}

// ── Parser ─────────────────────────────────────────────────────────────

export function parseItchioEntry(
  entry: ItchioRssEntry,
  signalType: "trending" | "jam_theme" = "jam_theme"
): ItchioSignal {
  return {
    source: "itchio-jams",
    signalType,
    name: entry.title,
    value: null,
    metadata: JSON.stringify({
      url: entry.link,
      description: entry.description.slice(0, 200),
    }),
    date: entry.published,
  };
}

// ── RSS Feed URLs ──────────────────────────────────────────────────────

const ITCHIO_FEEDS = [
  {
    url: "https://itch.io/games/newest/sort-popular.xml",
    signalType: "trending" as const,
  },
  {
    url: "https://itch.io/games/top-rated/price-free.xml",
    signalType: "trending" as const,
  },
  {
    url: "https://itch.io/jams/past.xml",
    signalType: "jam_theme" as const,
  },
  {
    url: "https://itch.io/games/new-and-popular.xml",
    signalType: "trending" as const,
  },
  {
    url: "https://itch.io/games/top-rated.xml",
    signalType: "trending" as const,
  },
];

// ── Scraper ────────────────────────────────────────────────────────────

export class ItchioJamsScraper extends BaseScraper<ItchioSignal> {
  config: ScraperConfig = {
    name: "itchio-jams",
    category: "community",
    rateLimit: { requests: 1, perSeconds: 2 },
    retryCount: 2,
    timeout: 10000,
  };

  async fetch(): Promise<ScraperResult<ItchioSignal>> {
    const allSignals: ItchioSignal[] = [];
    const errors: string[] = [];

    for (const feed of ITCHIO_FEEDS) {
      try {
        await this.rateLimit();

        const response = await fetch(feed.url, {
          signal: AbortSignal.timeout(this.config.timeout),
          headers: {
            "User-Agent": "GlobalGameMonitor/1.0",
          },
        });

        if (!response.ok) {
          errors.push(
            `Error fetching itch.io feed ${feed.url}: HTTP ${response.status}`
          );
          continue;
        }

        const xml = await response.text();
        const $ = cheerio.load(xml, { xml: true });

        const items: ItchioSignal[] = [];

        $("item, entry").each((_i, el) => {
          if (items.length >= 20) return false; // Limit 20 per feed

          const title = $(el).find("title").text();
          const link =
            $(el).find("link").attr("href") || $(el).find("link").text();
          const published =
            $(el).find("published").text() ||
            $(el).find("pubDate").text() ||
            new Date().toISOString();
          const description =
            $(el).find("description").text() ||
            $(el).find("summary").text() ||
            $(el).find("content").text();

          const entry: ItchioRssEntry = {
            title,
            link,
            published,
            description,
          };
          items.push(parseItchioEntry(entry, feed.signalType));
        });

        allSignals.push(...items);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Error fetching itch.io feed ${feed.url}: ${msg}`);
      }
    }

    return {
      source: this.config.name,
      fetchedAt: new Date(),
      records: allSignals,
      errors,
    };
  }

  async store(records: ItchioSignal[]): Promise<void> {
    const { db } = await import("@/lib/db/client");

    for (const signal of records) {
      // Skip if same source+name+date exists
      const existing = await db
        .select({ id: trendSignals.id })
        .from(trendSignals)
        .where(
          and(
            eq(trendSignals.source, signal.source),
            eq(trendSignals.name, signal.name),
            eq(trendSignals.date, signal.date)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        continue;
      }

      await db.insert(trendSignals).values({
        source: signal.source,
        signalType: signal.signalType,
        name: signal.name,
        value: signal.value,
        metadata: signal.metadata,
        date: signal.date,
      });
    }
  }
}
