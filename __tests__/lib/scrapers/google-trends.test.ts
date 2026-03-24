import { describe, it, expect } from "vitest";
import {
  parseTrendsResult,
  GoogleTrendsScraper,
} from "@/lib/scrapers/competitor/google-trends";

describe("parseTrendsResult", () => {
  it("parses Google Trends timeline data correctly", () => {
    const timelineData = [
      { time: "1710892800", value: [75] },
      { time: "1711497600", value: [82] },
      { time: "1712102400", value: [60] },
    ];

    const result = parseTrendsResult("Clash Royale", timelineData);

    expect(result).toHaveLength(3);
    expect(result[0].keyword).toBe("Clash Royale");
    expect(result[0].region).toBe("worldwide");
    expect(result[0].interestScore).toBe(75);
    // Verify the date is a valid ISO string
    expect(new Date(result[0].date).toISOString()).toBe(result[0].date);
  });

  it("handles empty timeline data", () => {
    const result = parseTrendsResult("Unknown Game", []);
    expect(result).toHaveLength(0);
  });

  it("handles missing value with default 0", () => {
    const timelineData = [
      { time: "1710892800", value: [] },
    ];

    const result = parseTrendsResult("Test", timelineData);
    expect(result[0].interestScore).toBe(0);
  });

  it("uses first value from value array", () => {
    const timelineData = [
      { time: "1710892800", value: [50, 30, 20] },
    ];

    const result = parseTrendsResult("Multi", timelineData);
    expect(result[0].interestScore).toBe(50);
  });

  it("converts Unix timestamp to ISO date string", () => {
    // 1710892800 = 2024-03-20T00:00:00.000Z
    const timelineData = [
      { time: "1710892800", value: [50] },
    ];

    const result = parseTrendsResult("DateTest", timelineData);
    const date = new Date(result[0].date);
    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(2); // March (0-indexed)
    expect(date.getDate()).toBe(20);
  });
});

describe("GoogleTrendsScraper config", () => {
  it("has correct config values", () => {
    const scraper = new GoogleTrendsScraper();
    expect(scraper.config.name).toBe("google-trends");
    expect(scraper.config.category).toBe("competitor");
    expect(scraper.config.rateLimit).toEqual({ requests: 1, perSeconds: 5 });
    expect(scraper.config.retryCount).toBe(2);
    expect(scraper.config.timeout).toBe(15000);
  });
});
