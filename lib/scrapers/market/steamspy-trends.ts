import { BaseScraper, ScraperConfig, ScraperResult } from "@/lib/scrapers/base-scraper";
import { trendSignals } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

// ── Types ──────────────────────────────────────────────────────────────

export interface SteamSpyTrendSignal {
  source: "steamspy-trends";
  signalType: "trending" | "tag_top";
  name: string;
  value: number;
  metadata: string;
  date: string;
}

interface SteamSpyTopResult {
  [appid: string]: {
    appid: number;
    name: string;
    developer: string;
    publisher: string;
    positive: number;
    negative: number;
    owners: string;
    average_2weeks: number;
    price: number;
  };
}

// ── Tag list ──────────────────────────────────────────────────────────

export const STEAMSPY_TAGS = [
  "Roguelike",
  "Tower+Defense",
  "Idle",
  "City+Builder",
  "Survival",
  "Deckbuilding",
];

// ── Parser ────────────────────────────────────────────────────────────

export function parseTop100(data: SteamSpyTopResult): SteamSpyTrendSignal[] {
  const today = new Date().toISOString().split("T")[0];
  return Object.values(data).map((item) => ({
    source: "steamspy-trends" as const,
    signalType: "trending" as const,
    name: item.name,
    value: item.average_2weeks,
    metadata: JSON.stringify({
      appid: item.appid,
      developer: item.developer,
      positive: item.positive,
      negative: item.negative,
      owners: item.owners,
      price: item.price / 100,
    }),
    date: today,
  }));
}

export function parseTagResults(
  data: SteamSpyTopResult,
  tag: string
): SteamSpyTrendSignal[] {
  const today = new Date().toISOString().split("T")[0];
  return Object.values(data).map((item) => ({
    source: "steamspy-trends" as const,
    signalType: "tag_top" as const,
    name: item.name,
    value: item.average_2weeks,
    metadata: JSON.stringify({
      appid: item.appid,
      tag: tag.replace("+", " "),
      developer: item.developer,
      positive: item.positive,
      negative: item.negative,
      owners: item.owners,
      price: item.price / 100,
    }),
    date: today,
  }));
}

// ── Scraper ────────────────────────────────────────────────────────────

export class SteamSpyTrendsScraper extends BaseScraper<SteamSpyTrendSignal> {
  config: ScraperConfig = {
    name: "steamspy-trends",
    category: "market",
    rateLimit: { requests: 1, perSeconds: 1 },
    retryCount: 2,
    timeout: 10000,
  };

  async fetch(): Promise<ScraperResult<SteamSpyTrendSignal>> {
    const allSignals: SteamSpyTrendSignal[] = [];
    const errors: string[] = [];

    // Fetch top 100 in 2 weeks
    try {
      await this.rateLimit();

      const response = await fetch(
        "https://steamspy.com/api.php?request=top100in2weeks",
        { signal: AbortSignal.timeout(this.config.timeout) }
      );

      if (!response.ok) {
        errors.push(`Error fetching top100in2weeks: HTTP ${response.status}`);
      } else {
        const data = await response.json();
        const signals = parseTop100(data);
        allSignals.push(...signals);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Error fetching top100in2weeks: ${msg}`);
    }

    // Fetch tag-based data
    for (const tag of STEAMSPY_TAGS) {
      try {
        await this.rateLimit();

        const response = await fetch(
          `https://steamspy.com/api.php?request=tag&tag=${tag}`,
          { signal: AbortSignal.timeout(this.config.timeout) }
        );

        if (!response.ok) {
          errors.push(`Error fetching tag ${tag}: HTTP ${response.status}`);
          continue;
        }

        const data = await response.json();
        const signals = parseTagResults(data, tag);
        allSignals.push(...signals);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Error fetching tag ${tag}: ${msg}`);
      }
    }

    return {
      source: this.config.name,
      fetchedAt: new Date(),
      records: allSignals,
      errors,
    };
  }

  async store(records: SteamSpyTrendSignal[]): Promise<void> {
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
