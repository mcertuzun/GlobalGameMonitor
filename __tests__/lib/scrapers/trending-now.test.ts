import { describe, it, expect } from "vitest";
import {
  parseTrendingGame,
  TrendingNowScraper,
} from "@/lib/scrapers/competitor/trending-now";

const mockTrendingGame = {
  name: "Elden Ring",
  platform: "Steam",
  rank: 1,
  trend: "up",
  playerCount: 250000,
  url: "https://trendingnow.games/elden-ring",
};

describe("parseTrendingGame", () => {
  it("parses a trending game entry correctly", () => {
    const result = parseTrendingGame(mockTrendingGame);
    expect(result.source).toBe("trending-now");
    expect(result.signalType).toBe("trending");
    expect(result.name).toBe("Elden Ring");
    expect(result.value).toBe(250000);
    expect(result.date).toBe(new Date().toISOString().split("T")[0]);

    const metadata = JSON.parse(result.metadata);
    expect(metadata.platform).toBe("Steam");
    expect(metadata.trend).toBe("up");
    expect(metadata.url).toBe("https://trendingnow.games/elden-ring");
  });

  it("uses playerCount as value when available", () => {
    const result = parseTrendingGame(mockTrendingGame);
    expect(result.value).toBe(250000);
  });

  it("falls back to rank when playerCount is not available", () => {
    const noPlayers = {
      ...mockTrendingGame,
      playerCount: null as unknown as number,
    };
    const result = parseTrendingGame(noPlayers);
    expect(result.value).toBe(1);
  });

  it("handles missing optional fields gracefully", () => {
    const minimal = {
      name: "Unknown Game",
      platform: null as unknown as string,
      rank: 5,
      trend: null as unknown as string,
      playerCount: null as unknown as number,
      url: null as unknown as string,
    };
    const result = parseTrendingGame(minimal);
    expect(result.name).toBe("Unknown Game");
    expect(result.value).toBe(5);

    const metadata = JSON.parse(result.metadata);
    expect(metadata.platform).toBeNull();
    expect(metadata.trend).toBeNull();
    expect(metadata.url).toBeNull();
  });

  it("sets today's date in ISO format", () => {
    const result = parseTrendingGame(mockTrendingGame);
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    expect(result.date).toMatch(dateRegex);
  });
});

describe("TrendingNowScraper config", () => {
  it("has correct config values", () => {
    const scraper = new TrendingNowScraper();
    expect(scraper.config.name).toBe("trending-now");
    expect(scraper.config.category).toBe("competitor");
    expect(scraper.config.rateLimit).toEqual({ requests: 1, perSeconds: 3 });
    expect(scraper.config.retryCount).toBe(2);
    expect(scraper.config.timeout).toBe(10000);
  });
});
