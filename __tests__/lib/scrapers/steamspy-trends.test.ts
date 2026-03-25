import { describe, it, expect } from "vitest";
import {
  SteamSpyTrendsScraper,
  parseTop100,
  parseTagResults,
  STEAMSPY_TAGS,
} from "@/lib/scrapers/market/steamspy-trends";

const mockTop100Data = {
  "730": {
    appid: 730,
    name: "Counter-Strike 2",
    developer: "Valve",
    publisher: "Valve",
    positive: 6500000,
    negative: 1200000,
    owners: "50,000,000 .. 100,000,000",
    average_2weeks: 45000,
    price: 0,
  },
  "570": {
    appid: 570,
    name: "Dota 2",
    developer: "Valve",
    publisher: "Valve",
    positive: 1500000,
    negative: 400000,
    owners: "100,000,000 .. 200,000,000",
    average_2weeks: 32000,
    price: 0,
  },
};

describe("SteamSpyTrendsScraper", () => {
  it("has correct config", () => {
    const scraper = new SteamSpyTrendsScraper();
    expect(scraper.config.name).toBe("steamspy-trends");
    expect(scraper.config.category).toBe("market");
    expect(scraper.config.rateLimit).toEqual({ requests: 1, perSeconds: 1 });
    expect(scraper.config.retryCount).toBe(2);
    expect(scraper.config.timeout).toBe(10000);
  });

  it("has correct tags defined", () => {
    expect(STEAMSPY_TAGS).toHaveLength(6);
    expect(STEAMSPY_TAGS).toContain("Roguelike");
    expect(STEAMSPY_TAGS).toContain("Idle");
    expect(STEAMSPY_TAGS).toContain("Deckbuilding");
  });
});

describe("parseTop100", () => {
  it("parses top 100 results into trend signals", () => {
    const signals = parseTop100(mockTop100Data);
    expect(signals).toHaveLength(2);

    const cs2 = signals.find((s) => s.name === "Counter-Strike 2");
    expect(cs2).toBeDefined();
    expect(cs2!.source).toBe("steamspy-trends");
    expect(cs2!.signalType).toBe("trending");
    expect(cs2!.value).toBe(45000);

    const metadata = JSON.parse(cs2!.metadata);
    expect(metadata.appid).toBe(730);
    expect(metadata.developer).toBe("Valve");
    expect(metadata.price).toBe(0);
  });

  it("handles empty data", () => {
    const signals = parseTop100({});
    expect(signals).toHaveLength(0);
  });
});

describe("parseTagResults", () => {
  it("parses tag results with correct tag metadata", () => {
    const signals = parseTagResults(mockTop100Data, "Roguelike");
    expect(signals).toHaveLength(2);

    for (const signal of signals) {
      expect(signal.source).toBe("steamspy-trends");
      expect(signal.signalType).toBe("tag_top");
      const metadata = JSON.parse(signal.metadata);
      expect(metadata.tag).toBe("Roguelike");
    }
  });

  it("normalizes tag with + to space", () => {
    const signals = parseTagResults(mockTop100Data, "Tower+Defense");
    const metadata = JSON.parse(signals[0].metadata);
    expect(metadata.tag).toBe("Tower Defense");
  });

  it("handles empty data", () => {
    const signals = parseTagResults({}, "Idle");
    expect(signals).toHaveLength(0);
  });
});
