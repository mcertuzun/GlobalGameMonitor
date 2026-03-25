import { describe, it, expect } from "vitest";
import { parseGooglePlayApp } from "@/lib/scrapers/market/google-play-detail";

const mockGPlayResult = {
  appId: "com.supercell.clashofclans",
  title: "Clash of Clans",
  developer: "Supercell",
  genre: "Strategy",
  score: 4.5,
  ratings: 62000000,
  maxInstalls: 500000000,
  free: true,
  price: 0,
  version: "16.0.8",
  icon: "https://example.com/icon.png",
  description: "Epic combat strategy game. Build your village and raise a clan!",
  histogram: { 1: 1000, 2: 2000, 3: 5000, 4: 15000, 5: 40000 },
  recentChanges: "Bug fixes and improvements",
  adSupported: true,
  offersIAP: true,
  IAPRange: "$0.99 - $99.99",
  released: "Aug 2, 2012",
  updated: 1710892800,
  contentRating: "Everyone 10+",
};

describe("parseGooglePlayApp", () => {
  it("parses google-play-scraper result with enriched fields", () => {
    const result = parseGooglePlayApp(mockGPlayResult);
    expect(result.storeId).toBe("com.supercell.clashofclans");
    expect(result.name).toBe("Clash of Clans");
    expect(result.rating).toBe(4.5);
    expect(result.downloadsEstimate).toBe(500000000);
    // Enriched fields
    expect(result.description).toBe("Epic combat strategy game. Build your village and raise a clan!");
    expect(result.histogram).toEqual({ 1: 1000, 2: 2000, 3: 5000, 4: 15000, 5: 40000 });
    expect(result.recentChanges).toBe("Bug fixes and improvements");
    expect(result.adSupported).toBe(true);
    expect(result.offersIAP).toBe(true);
    expect(result.IAPRange).toBe("$0.99 - $99.99");
    expect(result.released).toBe("Aug 2, 2012");
    expect(result.updated).toBe(1710892800);
    expect(result.contentRating).toBe("Everyone 10+");
  });

  it("handles missing enriched fields with defaults", () => {
    const minimal = {
      appId: "com.test.app",
      title: "Test",
      developer: "Dev",
      genre: "Casual",
      score: 3.0,
      ratings: 100,
      maxInstalls: 1000,
      free: true,
      price: 0,
      version: "1.0",
      icon: "",
    };
    const result = parseGooglePlayApp(minimal);
    expect(result.description).toBe("");
    expect(result.histogram).toEqual({});
    expect(result.recentChanges).toBe("");
    expect(result.adSupported).toBe(false);
    expect(result.offersIAP).toBe(false);
    expect(result.IAPRange).toBe("");
    expect(result.released).toBe("");
    expect(result.updated).toBe(0);
    expect(result.contentRating).toBe("");
  });

  it("truncates description to 1000 chars", () => {
    const longDesc = "A".repeat(2000);
    const data = { ...mockGPlayResult, description: longDesc };
    const result = parseGooglePlayApp(data);
    expect(result.description.length).toBe(1000);
  });
});
