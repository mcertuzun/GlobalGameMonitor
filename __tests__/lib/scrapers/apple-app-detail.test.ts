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
      releaseNotes: "Bug fixes and performance improvements",
      releaseDate: "2012-08-02T00:00:00Z",
      currentVersionReleaseDate: "2024-03-15T00:00:00Z",
      fileSizeBytes: "287654321",
      languageCodesISO2A: ["EN", "FR", "DE", "JA"],
      contentAdvisoryRating: "9+",
      screenshotUrls: [
        "https://example.com/ss1.png",
        "https://example.com/ss2.png",
        "https://example.com/ss3.png",
      ],
    },
  ],
};

describe("parseItunesLookupResponse", () => {
  it("parses iTunes lookup response with enriched fields", () => {
    const result = parseItunesLookupResponse(mockItunesResponse);
    expect(result).not.toBeNull();
    // Original fields
    expect(result!.storeId).toBe("529479190");
    expect(result!.name).toBe("Clash of Clans");
    expect(result!.developer).toBe("Supercell");
    expect(result!.category).toBe("Strategy");
    expect(result!.rating).toBe(4.6);
    expect(result!.ratingCount).toBe(5200000);
    expect(result!.price).toBe(0);
    expect(result!.version).toBe("16.0.8");
    expect(result!.iconUrl).toBe("https://example.com/icon.png");
    // Enriched fields
    expect(result!.description).toBe("Epic combat strategy game");
    expect(result!.releaseNotes).toBe("Bug fixes and performance improvements");
    expect(result!.releaseDate).toBe("2012-08-02T00:00:00Z");
    expect(result!.currentVersionReleaseDate).toBe("2024-03-15T00:00:00Z");
    expect(result!.fileSizeBytes).toBe("287654321");
    expect(result!.languageCodesISO2A).toEqual(["EN", "FR", "DE", "JA"]);
    expect(result!.contentAdvisoryRating).toBe("9+");
    expect(result!.screenshotCount).toBe(3);
  });

  it("returns null for empty response", () => {
    const result = parseItunesLookupResponse({ resultCount: 0, results: [] });
    expect(result).toBeNull();
  });

  it("handles missing enriched fields with defaults", () => {
    const minimal = {
      resultCount: 1,
      results: [
        {
          trackId: 123,
          trackName: "Test",
          artistName: "Dev",
          primaryGenreName: "Games",
          averageUserRating: 3.0,
          userRatingCount: 100,
          price: 0,
          version: "1.0",
          artworkUrl100: "",
        },
      ],
    };
    const result = parseItunesLookupResponse(minimal);
    expect(result).not.toBeNull();
    expect(result!.description).toBe("");
    expect(result!.releaseNotes).toBe("");
    expect(result!.releaseDate).toBe("");
    expect(result!.currentVersionReleaseDate).toBe("");
    expect(result!.fileSizeBytes).toBe("");
    expect(result!.languageCodesISO2A).toEqual([]);
    expect(result!.contentAdvisoryRating).toBe("");
    expect(result!.screenshotCount).toBe(0);
  });

  it("truncates description to 1000 chars", () => {
    const longDesc = "B".repeat(2000);
    const data = {
      resultCount: 1,
      results: [
        {
          ...mockItunesResponse.results[0],
          description: longDesc,
        },
      ],
    };
    const result = parseItunesLookupResponse(data);
    expect(result!.description.length).toBe(1000);
  });
});
