import { describe, it, expect } from "vitest";
import {
  parseSteamSpyApp,
  SteamSpyScraper,
} from "@/lib/scrapers/market/steamspy";

const mockSteamSpyResult = {
  appid: 730,
  name: "Counter-Strike 2",
  developer: "Valve",
  publisher: "Valve",
  score_rank: "",
  positive: 6500000,
  negative: 1200000,
  owners: "50,000,000 .. 100,000,000",
  average_forever: 32000,
  price: 0,
};

describe("parseSteamSpyApp", () => {
  it("parses SteamSpy API result correctly", () => {
    const result = parseSteamSpyApp(mockSteamSpyResult);
    expect(result.storeId).toBe("730");
    expect(result.name).toBe("Counter-Strike 2");
    expect(result.developer).toBe("Valve");
    expect(result.ratingCount).toBe(7700000);
    expect(result.rating).toBeCloseTo(6500000 / 7700000, 5);
    expect(result.downloadsEstimate).toBe(50000000);
    expect(result.price).toBe(0);
    expect(result.iconUrl).toBe("");
  });

  it("parses paid game price from cents", () => {
    const paid = { ...mockSteamSpyResult, price: 2999 };
    const result = parseSteamSpyApp(paid);
    expect(result.price).toBeCloseTo(29.99, 2);
  });

  it("handles zero positive and negative reviews", () => {
    const noReviews = { ...mockSteamSpyResult, positive: 0, negative: 0 };
    const result = parseSteamSpyApp(noReviews);
    expect(result.rating).toBe(0);
    expect(result.ratingCount).toBe(0);
  });

  it("parses owners string with smaller range", () => {
    const small = { ...mockSteamSpyResult, owners: "1,000,000 .. 2,000,000" };
    const result = parseSteamSpyApp(small);
    expect(result.downloadsEstimate).toBe(1000000);
  });
});

describe("SteamSpyScraper config", () => {
  it("has correct config values", () => {
    const scraper = new SteamSpyScraper();
    expect(scraper.config.name).toBe("steamspy");
    expect(scraper.config.category).toBe("market");
    expect(scraper.config.rateLimit).toEqual({ requests: 1, perSeconds: 1 });
    expect(scraper.config.retryCount).toBe(2);
    expect(scraper.config.timeout).toBe(10000);
  });
});
