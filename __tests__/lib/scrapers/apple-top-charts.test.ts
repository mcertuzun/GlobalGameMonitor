import { describe, it, expect } from "vitest";
import { AppleTopChartsScraper, parseAppleRssResponse } from "@/lib/scrapers/market/apple-top-charts";

const mockRssResponse = {
  feed: {
    title: "Top Free Apps",
    results: [
      {
        artistName: "Supercell",
        id: "529479190",
        name: "Clash of Clans",
        artworkUrl100: "https://example.com/icon.png",
        genres: [{ name: "Strategy" }],
        url: "https://apps.apple.com/app/clash-of-clans/id529479190",
      },
      {
        artistName: "King",
        id: "553834731",
        name: "Candy Crush Saga",
        artworkUrl100: "https://example.com/icon2.png",
        genres: [{ name: "Casual" }],
        url: "https://apps.apple.com/app/candy-crush-saga/id553834731",
      },
    ],
  },
};

describe("parseAppleRssResponse", () => {
  it("parses RSS response into chart entries", () => {
    const entries = parseAppleRssResponse(mockRssResponse, "US", "games", "free");
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      store: "appstore",
      country: "US",
      category: "games",
      chartType: "free",
      rank: 1,
      storeId: "529479190",
      name: "Clash of Clans",
      developer: "Supercell",
      iconUrl: "https://example.com/icon.png",
      genre: "Strategy",
    });
    expect(entries[1].rank).toBe(2);
    expect(entries[1].name).toBe("Candy Crush Saga");
  });

  it("handles empty results", () => {
    const entries = parseAppleRssResponse({ feed: { results: [] } }, "US", "games", "free");
    expect(entries).toHaveLength(0);
  });
});

describe("AppleTopChartsScraper", () => {
  it("has correct config", () => {
    const scraper = new AppleTopChartsScraper();
    expect(scraper.config.name).toBe("apple-top-charts");
    expect(scraper.config.category).toBe("market");
  });
});
