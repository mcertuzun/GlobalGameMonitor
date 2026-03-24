import { describe, it, expect } from "vitest";
import {
  parseSteamStoreApp,
  SteamApiScraper,
} from "@/lib/scrapers/market/steam-api";

const mockSteamStoreData = {
  steam_appid: 570,
  name: "Dota 2",
  developers: ["Valve"],
  publishers: ["Valve"],
  genres: [{ id: "1", description: "Action" }, { id: "2", description: "Strategy" }],
  metacritic: { score: 90, url: "https://www.metacritic.com/game/pc/dota-2" },
  price_overview: {
    currency: "USD",
    initial: 0,
    final: 0,
    discount_percent: 0,
    initial_formatted: "",
    final_formatted: "Free to Play",
  },
  header_image: "https://cdn.akamai.steamstatic.com/steam/apps/570/header.jpg",
  short_description: "Every day, millions of players worldwide enter battle as one of over a hundred Dota heroes.",
};

describe("parseSteamStoreApp", () => {
  it("parses Steam Store API result correctly", () => {
    const result = parseSteamStoreApp(mockSteamStoreData);
    expect(result.storeId).toBe("570");
    expect(result.name).toBe("Dota 2");
    expect(result.developer).toBe("Valve");
    expect(result.category).toBe("Action");
    expect(result.rating).toBeCloseTo(0.9, 2);
    expect(result.price).toBe(0);
    expect(result.iconUrl).toBe(
      "https://cdn.akamai.steamstatic.com/steam/apps/570/header.jpg"
    );
    expect(result.version).toBe("");
  });

  it("handles missing metacritic score", () => {
    const noMeta = { ...mockSteamStoreData, metacritic: undefined };
    const result = parseSteamStoreApp(noMeta);
    expect(result.rating).toBeNull();
  });

  it("handles missing price_overview (free game)", () => {
    const noPrice = { ...mockSteamStoreData, price_overview: undefined };
    const result = parseSteamStoreApp(noPrice);
    expect(result.price).toBe(0);
  });

  it("handles missing genres", () => {
    const noGenres = { ...mockSteamStoreData, genres: undefined };
    const result = parseSteamStoreApp(noGenres);
    expect(result.category).toBeUndefined();
  });

  it("handles missing developers", () => {
    const noDevs = { ...mockSteamStoreData, developers: undefined };
    const result = parseSteamStoreApp(noDevs);
    expect(result.developer).toBeUndefined();
  });

  it("converts price from cents correctly", () => {
    const paid = {
      ...mockSteamStoreData,
      price_overview: { ...mockSteamStoreData.price_overview, final: 5999 },
    };
    const result = parseSteamStoreApp(paid);
    expect(result.price).toBeCloseTo(59.99, 2);
  });
});

describe("SteamApiScraper config", () => {
  it("has correct config values", () => {
    const scraper = new SteamApiScraper();
    expect(scraper.config.name).toBe("steam-api");
    expect(scraper.config.category).toBe("market");
    expect(scraper.config.rateLimit).toEqual({ requests: 1, perSeconds: 2 });
    expect(scraper.config.retryCount).toBe(2);
    expect(scraper.config.timeout).toBe(10000);
  });
});
