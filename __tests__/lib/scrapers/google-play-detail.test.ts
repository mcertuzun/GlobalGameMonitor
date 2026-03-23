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
};

describe("parseGooglePlayApp", () => {
  it("parses google-play-scraper result", () => {
    const result = parseGooglePlayApp(mockGPlayResult);
    expect(result.storeId).toBe("com.supercell.clashofclans");
    expect(result.name).toBe("Clash of Clans");
    expect(result.rating).toBe(4.5);
    expect(result.downloadsEstimate).toBe(500000000);
  });
});
