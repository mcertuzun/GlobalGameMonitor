import { describe, it, expect } from "vitest";
import {
  calculateTrafficScore,
  calculateDifficultyScore,
  GAME_KEYWORDS,
  KeywordScorerScraper,
} from "@/lib/scrapers/competitor/keyword-scorer";
import type { GPlaySearchResult } from "@/lib/scrapers/competitor/keyword-scorer";

describe("calculateTrafficScore", () => {
  it("returns 0 for empty results", () => {
    expect(calculateTrafficScore([])).toBe(0);
  });

  it("returns 0 for results with zero installs", () => {
    const results: GPlaySearchResult[] = [
      { appId: "a", maxInstalls: 0 },
      { appId: "b", maxInstalls: 0 },
    ];
    expect(calculateTrafficScore(results)).toBe(0);
  });

  it("calculates traffic score for popular apps", () => {
    const results: GPlaySearchResult[] = Array.from({ length: 10 }, (_, i) => ({
      appId: `app-${i}`,
      maxInstalls: 10_000_000, // 10M installs each
    }));

    const score = calculateTrafficScore(results);
    // log10(10M) = 7, (7 - 3) / 0.6 = 6.67
    expect(score).toBeGreaterThan(6);
    expect(score).toBeLessThan(7);
  });

  it("returns max 10 for very high install counts", () => {
    const results: GPlaySearchResult[] = Array.from({ length: 10 }, (_, i) => ({
      appId: `app-${i}`,
      maxInstalls: 10_000_000_000, // 10B — unrealistic but tests cap
    }));

    const score = calculateTrafficScore(results);
    expect(score).toBe(10);
  });

  it("only considers top 10 results", () => {
    const results: GPlaySearchResult[] = Array.from({ length: 20 }, (_, i) => ({
      appId: `app-${i}`,
      maxInstalls: i < 10 ? 1_000_000 : 1, // top 10 have 1M, rest have 1
    }));

    const score = calculateTrafficScore(results);
    // log10(1M) = 6, (6 - 3) / 0.6 = 5.0
    expect(score).toBe(5);
  });

  it("uses minInstalls when maxInstalls is missing", () => {
    const results: GPlaySearchResult[] = [
      { appId: "a", minInstalls: 100_000 },
    ];

    const score = calculateTrafficScore(results);
    // log10(100K) = 5, (5 - 3) / 0.6 = 3.33
    expect(score).toBeGreaterThan(3);
    expect(score).toBeLessThan(4);
  });
});

describe("calculateDifficultyScore", () => {
  it("returns 0 when no apps have >1M installs", () => {
    const results: GPlaySearchResult[] = [
      { appId: "a", maxInstalls: 500_000 },
      { appId: "b", maxInstalls: 100_000 },
    ];

    expect(calculateDifficultyScore(results)).toBe(0);
  });

  it("returns 10 when all apps have >1M installs", () => {
    const results: GPlaySearchResult[] = Array.from({ length: 20 }, (_, i) => ({
      appId: `app-${i}`,
      maxInstalls: 5_000_000,
    }));

    expect(calculateDifficultyScore(results)).toBe(10);
  });

  it("returns proportional score", () => {
    const results: GPlaySearchResult[] = Array.from({ length: 20 }, (_, i) => ({
      appId: `app-${i}`,
      maxInstalls: i < 10 ? 5_000_000 : 100, // 10 out of 20 have >1M
    }));

    expect(calculateDifficultyScore(results)).toBe(5);
  });

  it("handles empty results", () => {
    // Empty array should not divide by zero
    expect(calculateDifficultyScore([])).toBe(0);
  });
});

describe("GAME_KEYWORDS", () => {
  it("contains expected keywords", () => {
    expect(GAME_KEYWORDS).toContain("idle rpg");
    expect(GAME_KEYWORDS).toContain("tower defense");
    expect(GAME_KEYWORDS).toContain("match 3");
    expect(GAME_KEYWORDS).toContain("deck builder");
  });

  it("has 15 keywords", () => {
    expect(GAME_KEYWORDS).toHaveLength(15);
  });
});

describe("KeywordScorerScraper config", () => {
  it("has correct config values", () => {
    const scraper = new KeywordScorerScraper();
    expect(scraper.config.name).toBe("keyword-scorer");
    expect(scraper.config.category).toBe("competitor");
    expect(scraper.config.rateLimit).toEqual({ requests: 1, perSeconds: 3 });
    expect(scraper.config.retryCount).toBe(2);
    expect(scraper.config.timeout).toBe(30000);
  });
});
