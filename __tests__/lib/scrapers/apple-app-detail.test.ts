import { describe, it, expect } from "vitest";
import { parseItunesLookupResponse } from "@/lib/scrapers/market/apple-app-detail";

const mockItunesResponse = {
  resultCount: 1,
  results: [
    {
      trackId: 529479190,
      trackName: "Clash of Clans",
      artistName: "Supercell",
      primaryGenreName: "Strategy",
      averageUserRating: 4.6,
      userRatingCount: 5200000,
      price: 0,
      version: "16.0.8",
      artworkUrl100: "https://example.com/icon.png",
      description: "Epic combat strategy game",
    },
  ],
};

describe("parseItunesLookupResponse", () => {
  it("parses iTunes lookup response", () => {
    const result = parseItunesLookupResponse(mockItunesResponse);
    expect(result).toEqual({
      storeId: "529479190",
      name: "Clash of Clans",
      developer: "Supercell",
      category: "Strategy",
      rating: 4.6,
      ratingCount: 5200000,
      price: 0,
      version: "16.0.8",
      iconUrl: "https://example.com/icon.png",
    });
  });

  it("returns null for empty response", () => {
    const result = parseItunesLookupResponse({ resultCount: 0, results: [] });
    expect(result).toBeNull();
  });
});
