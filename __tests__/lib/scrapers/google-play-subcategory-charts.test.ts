import { describe, it, expect } from "vitest";
import {
  GooglePlaySubcategoryChartsScraper,
  parseSubcategoryResults,
  GAME_SUBCATEGORIES,
} from "@/lib/scrapers/market/google-play-subcategory-charts";

describe("GooglePlaySubcategoryChartsScraper", () => {
  it("has correct config", () => {
    const scraper = new GooglePlaySubcategoryChartsScraper();
    expect(scraper.config.name).toBe("google-play-subcategory-charts");
    expect(scraper.config.category).toBe("market");
    expect(scraper.config.rateLimit).toEqual({ requests: 1, perSeconds: 3 });
    expect(scraper.config.retryCount).toBe(2);
    expect(scraper.config.timeout).toBe(30000);
  });

  it("has 11 game subcategories defined", () => {
    expect(GAME_SUBCATEGORIES).toHaveLength(11);
    expect(GAME_SUBCATEGORIES).toContain("GAME_ACTION");
    expect(GAME_SUBCATEGORIES).toContain("GAME_STRATEGY");
    expect(GAME_SUBCATEGORIES).toContain("GAME_WORD");
  });
});

describe("parseSubcategoryResults", () => {
  it("parses results into chart entries with correct subcategory", () => {
    const mockResults = [
      {
        appId: "com.example.game1",
        title: "Action Game 1",
        developer: "Dev1",
        icon: "https://example.com/icon1.png",
        genre: "Action",
      },
      {
        appId: "com.example.game2",
        title: "Action Game 2",
        developer: "Dev2",
        icon: "https://example.com/icon2.png",
        genre: "Action",
      },
    ];

    const entries = parseSubcategoryResults(mockResults, "GAME_ACTION");
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      store: "playstore",
      country: "US",
      category: "GAME_ACTION",
      chartType: "free",
      rank: 1,
      storeId: "com.example.game1",
      name: "Action Game 1",
      developer: "Dev1",
      iconUrl: "https://example.com/icon1.png",
      genre: "Action",
    });
    expect(entries[1].rank).toBe(2);
    expect(entries[1].category).toBe("GAME_ACTION");
  });

  it("handles empty results", () => {
    const entries = parseSubcategoryResults([], "GAME_PUZZLE");
    expect(entries).toHaveLength(0);
  });

  it("handles missing genre gracefully", () => {
    const results = [
      {
        appId: "com.test.app",
        title: "Test",
        developer: "Dev",
        icon: "",
        genre: undefined as unknown as string,
      },
    ];
    const entries = parseSubcategoryResults(results, "GAME_CASUAL");
    expect(entries[0].genre).toBe("");
  });
});
