import { describe, it, expect } from "vitest";
import {
  parseTrendsResult,
  parseMultiKeywordTrendsResult,
  parseRelatedQueries,
  GoogleTrendsScraper,
  GENRE_KEYWORDS,
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

describe("parseMultiKeywordTrendsResult", () => {
  it("parses multi-keyword timeline data", () => {
    const keywords = ["idle game", "merge game", "puzzle game"];
    const timelineData = [
      { time: "1710892800", value: [75, 50, 90] },
      { time: "1711497600", value: [80, 55, 85] },
    ];

    const result = parseMultiKeywordTrendsResult(keywords, timelineData);
    // 3 keywords * 2 time points = 6 records
    expect(result).toHaveLength(6);

    // First time point
    expect(result[0].keyword).toBe("idle game");
    expect(result[0].interestScore).toBe(75);
    expect(result[1].keyword).toBe("merge game");
    expect(result[1].interestScore).toBe(50);
    expect(result[2].keyword).toBe("puzzle game");
    expect(result[2].interestScore).toBe(90);

    // Second time point
    expect(result[3].keyword).toBe("idle game");
    expect(result[3].interestScore).toBe(80);
  });

  it("handles empty timeline data", () => {
    const result = parseMultiKeywordTrendsResult(["a", "b"], []);
    expect(result).toHaveLength(0);
  });

  it("handles missing values with default 0", () => {
    const result = parseMultiKeywordTrendsResult(
      ["a", "b", "c"],
      [{ time: "1710892800", value: [10] }]
    );
    expect(result).toHaveLength(3);
    expect(result[0].interestScore).toBe(10);
    expect(result[1].interestScore).toBe(0);
    expect(result[2].interestScore).toBe(0);
  });
});

describe("parseRelatedQueries", () => {
  it("parses rising queries from response data", () => {
    const responseData = {
      default: {
        rankedList: [
          {
            rankedKeyword: [
              { query: "top idle game", value: 100 },
              { query: "best idle game", value: 90 },
            ],
          },
          {
            rankedKeyword: [
              { query: "new idle game 2024", value: 5000 },
              { query: "idle game offline", value: 3000 },
            ],
          },
        ],
      },
    };

    const result = parseRelatedQueries(responseData);
    // Should return rising list (second list)
    expect(result).toHaveLength(2);
    expect(result[0].query).toBe("new idle game 2024");
    expect(result[0].value).toBe(5000);
    expect(result[1].query).toBe("idle game offline");
    expect(result[1].value).toBe(3000);
  });

  it("falls back to top list when rising list is missing", () => {
    const responseData = {
      default: {
        rankedList: [
          {
            rankedKeyword: [
              { query: "top idle game", value: 100 },
            ],
          },
        ],
      },
    };

    const result = parseRelatedQueries(responseData);
    expect(result).toHaveLength(1);
    expect(result[0].query).toBe("top idle game");
  });

  it("handles empty response", () => {
    const result = parseRelatedQueries({});
    expect(result).toHaveLength(0);
  });
});

describe("GENRE_KEYWORDS", () => {
  it("has 10 genre keywords", () => {
    expect(GENRE_KEYWORDS).toHaveLength(10);
  });

  it("includes expected genre keywords", () => {
    expect(GENRE_KEYWORDS).toContain("idle game");
    expect(GENRE_KEYWORDS).toContain("roguelike game");
    expect(GENRE_KEYWORDS).toContain("rpg game");
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
