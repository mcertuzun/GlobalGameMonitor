import { BaseScraper, ScraperConfig, ScraperResult } from "@/lib/scrapers/base-scraper";
import { keywordScores } from "@/lib/db/schema";
import { SCRAPER_LIMITS } from "@/lib/config";

// ── Types ──────────────────────────────────────────────────────────────

export interface ParsedKeywordScore {
  keyword: string;
  store: string;
  trafficScore: number;
  difficultyScore: number;
  date: string;
}

export interface GPlaySearchResult {
  appId?: string;
  title?: string;
  score?: number;
  maxInstalls?: number;
  minInstalls?: number;
}

// ── Keywords ────────────────────────────────────────────────────────────

export const GAME_KEYWORDS = [
  "idle rpg", "merge puzzle", "tower defense", "roguelike",
  "cozy farm", "city builder", "auto battler", "card game",
  "survival game", "puzzle adventure", "match 3", "clicker game",
  "base building", "gacha game", "deck builder",
];

// ── Scoring Functions ───────────────────────────────────────────────────

export function calculateTrafficScore(results: GPlaySearchResult[]): number {
  if (results.length === 0) return 0;

  const top10 = results.slice(0, 10);
  const installs = top10.map((r) => r.maxInstalls ?? r.minInstalls ?? 0);
  const avgInstalls = installs.reduce((sum, n) => sum + n, 0) / top10.length;

  if (avgInstalls <= 0) return 0;

  // log10(avgInstalls) normalized to 0-10 range
  // log10(1000) = 3, log10(1B) = 9 -> normalize: (log10 - 3) / 0.6
  const raw = Math.log10(avgInstalls);
  return Math.max(0, Math.min(10, (raw - 3) / 0.6));
}

export function calculateDifficultyScore(results: GPlaySearchResult[]): number {
  const total = Math.max(results.length, 1);
  const highInstallCount = results.filter(
    (r) => (r.maxInstalls ?? r.minInstalls ?? 0) > 1_000_000
  ).length;

  return (highInstallCount / total) * 10;
}

// ── Scraper ────────────────────────────────────────────────────────────

export class KeywordScorerScraper extends BaseScraper<ParsedKeywordScore> {
  config: ScraperConfig = {
    name: "keyword-scorer",
    category: "competitor",
    rateLimit: { requests: 1, perSeconds: 3 },
    retryCount: 2,
    timeout: 30000,
  };

  async fetch(): Promise<ScraperResult<ParsedKeywordScore>> {
    const gplayModule = require("google-play-scraper");
    const gplay = gplayModule.default || gplayModule;

    const allScores: ParsedKeywordScore[] = [];
    const errors: string[] = [];
    const today = new Date().toISOString().split("T")[0];

    for (const keyword of GAME_KEYWORDS) {
      try {
        await this.rateLimit();

        const results: GPlaySearchResult[] = await gplay.search({
          term: keyword,
          num: SCRAPER_LIMITS.keywords.searchResultsPerKeyword,
          fullDetail: true,
        });

        const resultList = Array.isArray(results) ? results : [];

        const trafficScore = calculateTrafficScore(resultList);
        const difficultyScore = calculateDifficultyScore(resultList);

        allScores.push({
          keyword,
          store: "playstore",
          trafficScore: Math.round(trafficScore * 100) / 100,
          difficultyScore: Math.round(difficultyScore * 100) / 100,
          date: today,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Error scoring keyword "${keyword}": ${msg}`);
      }
    }

    return {
      source: this.config.name,
      fetchedAt: new Date(),
      records: allScores,
      errors,
    };
  }

  async store(records: ParsedKeywordScore[]): Promise<void> {
    const { db } = await import("@/lib/db/client");

    for (const record of records) {
      await db.insert(keywordScores).values({
        keyword: record.keyword,
        store: record.store,
        trafficScore: record.trafficScore,
        difficultyScore: record.difficultyScore,
        date: record.date,
      });
    }
  }
}
