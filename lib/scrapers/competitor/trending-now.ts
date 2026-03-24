import {
  BaseScraper,
  ScraperConfig,
  ScraperResult,
} from "@/lib/scrapers/base-scraper";
import { trendSignals } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import * as cheerio from "cheerio";

// ── Types ──────────────────────────────────────────────────────────────

export interface TrendingGameRaw {
  name: string;
  platform: string;
  rank: number;
  trend: string;
  playerCount: number;
  url: string;
}

export interface TrendingSignal {
  source: "trending-now";
  signalType: "trending";
  name: string;
  value: number;
  metadata: string;
  date: string;
}

// ── Parser ─────────────────────────────────────────────────────────────

export function parseTrendingGame(data: TrendingGameRaw): TrendingSignal {
  const today = new Date().toISOString().split("T")[0];

  return {
    source: "trending-now",
    signalType: "trending",
    name: data.name,
    value: data.playerCount ?? data.rank,
    metadata: JSON.stringify({
      platform: data.platform ?? null,
      trend: data.trend ?? null,
      url: data.url ?? null,
    }),
    date: today,
  };
}

// ── Scraper ────────────────────────────────────────────────────────────

const TRENDING_JSON_URL = "https://trendingnow.games/api/games.json";
const TRENDING_RSS_URL = "https://trendingnow.games/feed.xml";
const TRENDING_HTML_URL = "https://trendingnow.games/";

export class TrendingNowScraper extends BaseScraper<TrendingSignal> {
  config: ScraperConfig = {
    name: "trending-now",
    category: "competitor",
    rateLimit: { requests: 1, perSeconds: 3 },
    retryCount: 2,
    timeout: 10000,
  };

  async fetch(): Promise<ScraperResult<TrendingSignal>> {
    const errors: string[] = [];

    // Try JSON feed first
    try {
      const result = await this.fetchJson();
      if (result.length > 0) {
        return {
          source: this.config.name,
          fetchedAt: new Date(),
          records: result,
          errors,
        };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`JSON feed failed: ${msg}`);
    }

    await this.rateLimit();

    // Fallback to RSS
    try {
      const result = await this.fetchRss();
      if (result.length > 0) {
        return {
          source: this.config.name,
          fetchedAt: new Date(),
          records: result,
          errors,
        };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`RSS feed failed: ${msg}`);
    }

    await this.rateLimit();

    // Fallback to HTML scrape
    try {
      const result = await this.fetchHtml();
      return {
        source: this.config.name,
        fetchedAt: new Date(),
        records: result,
        errors,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`HTML scrape failed: ${msg}`);
    }

    return {
      source: this.config.name,
      fetchedAt: new Date(),
      records: [],
      errors,
    };
  }

  private async fetchJson(): Promise<TrendingSignal[]> {
    const response = await fetch(TRENDING_JSON_URL, {
      signal: AbortSignal.timeout(this.config.timeout),
      headers: { "User-Agent": "GlobalGameMonitor/1.0" },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const games = Array.isArray(data) ? data : data.games ?? [];

    return games.slice(0, 50).map((game: TrendingGameRaw, index: number) =>
      parseTrendingGame({
        name: game.name,
        platform: game.platform,
        rank: game.rank ?? index + 1,
        trend: game.trend,
        playerCount: game.playerCount,
        url: game.url,
      })
    );
  }

  private async fetchRss(): Promise<TrendingSignal[]> {
    const response = await fetch(TRENDING_RSS_URL, {
      signal: AbortSignal.timeout(this.config.timeout),
      headers: { "User-Agent": "GlobalGameMonitor/1.0" },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const xml = await response.text();
    const $ = cheerio.load(xml, { xml: true });
    const results: TrendingSignal[] = [];
    const today = new Date().toISOString().split("T")[0];

    $("item, entry").each((_i, el) => {
      if (results.length >= 50) return false;

      const name = $(el).find("title").text();
      if (!name) return;

      results.push({
        source: "trending-now",
        signalType: "trending",
        name,
        value: results.length + 1, // Use position as rank
        metadata: JSON.stringify({
          platform: null,
          trend: null,
          url:
            $(el).find("link").attr("href") || $(el).find("link").text() || null,
        }),
        date: today,
      });
    });

    return results;
  }

  private async fetchHtml(): Promise<TrendingSignal[]> {
    const response = await fetch(TRENDING_HTML_URL, {
      signal: AbortSignal.timeout(this.config.timeout),
      headers: { "User-Agent": "GlobalGameMonitor/1.0" },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const results: TrendingSignal[] = [];
    const today = new Date().toISOString().split("T")[0];

    // Try common selectors for game list items
    const selectors = [
      ".game-item",
      ".trending-game",
      "[data-game]",
      "table tbody tr",
      ".game-list li",
      ".game-card",
    ];

    for (const selector of selectors) {
      $(selector).each((_i, el) => {
        if (results.length >= 50) return false;

        const name =
          $(el).find(".game-name, .title, h3, h4, td:first-child").text().trim() ||
          $(el).attr("data-game") ||
          $(el).text().trim();

        if (!name || name.length > 200) return;

        const link = $(el).find("a").attr("href") || null;
        const platform =
          $(el).find(".platform, td:nth-child(2)").text().trim() || null;

        results.push({
          source: "trending-now",
          signalType: "trending",
          name,
          value: results.length + 1,
          metadata: JSON.stringify({
            platform,
            trend: null,
            url: link,
          }),
          date: today,
        });
      });

      if (results.length > 0) break; // Found a working selector
    }

    return results;
  }

  async store(records: TrendingSignal[]): Promise<void> {
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
