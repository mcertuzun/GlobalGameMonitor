import { describe, it, expect } from "vitest";
import {
  parseGPlaySimilar,
  parseAppStoreSimilar,
  SimilarAppsScraper,
} from "@/lib/scrapers/market/similar-apps";

describe("parseGPlaySimilar", () => {
  it("parses a full Google Play similar app result", () => {
    const raw = {
      appId: "com.supercell.brawlstars",
      title: "Brawl Stars",
      developer: "Supercell",
      score: 4.3,
    };

    const result = parseGPlaySimilar(raw);

    expect(result.similarStoreId).toBe("com.supercell.brawlstars");
    expect(result.similarName).toBe("Brawl Stars");
    expect(result.similarDeveloper).toBe("Supercell");
    expect(result.similarScore).toBe(4.3);
  });

  it("handles missing optional fields with defaults", () => {
    const raw = {};

    const result = parseGPlaySimilar(raw);

    expect(result.similarStoreId).toBe("");
    expect(result.similarName).toBe("");
    expect(result.similarDeveloper).toBeNull();
    expect(result.similarScore).toBeNull();
  });

  it("handles zero score", () => {
    const raw = { appId: "com.test", title: "Test", score: 0 };

    const result = parseGPlaySimilar(raw);

    expect(result.similarScore).toBe(0);
  });
});

describe("parseAppStoreSimilar", () => {
  it("parses a full App Store similar app result", () => {
    const raw = {
      id: 1234567890,
      title: "Clash Royale",
      developer: "Supercell",
      score: 4.6,
    };

    const result = parseAppStoreSimilar(raw);

    expect(result.similarStoreId).toBe("1234567890");
    expect(result.similarName).toBe("Clash Royale");
    expect(result.similarDeveloper).toBe("Supercell");
    expect(result.similarScore).toBe(4.6);
  });

  it("converts numeric id to string", () => {
    const raw = { id: 999 };

    const result = parseAppStoreSimilar(raw);

    expect(result.similarStoreId).toBe("999");
  });

  it("handles string id", () => {
    const raw = { id: "abc123" };

    const result = parseAppStoreSimilar(raw);

    expect(result.similarStoreId).toBe("abc123");
  });

  it("handles missing optional fields with defaults", () => {
    const raw = {};

    const result = parseAppStoreSimilar(raw);

    expect(result.similarStoreId).toBe("");
    expect(result.similarName).toBe("");
    expect(result.similarDeveloper).toBeNull();
    expect(result.similarScore).toBeNull();
  });
});

describe("SimilarAppsScraper config", () => {
  it("has correct config values", () => {
    const scraper = new SimilarAppsScraper();
    expect(scraper.config.name).toBe("similar-apps");
    expect(scraper.config.category).toBe("competitor");
    expect(scraper.config.rateLimit).toEqual({ requests: 1, perSeconds: 2 });
    expect(scraper.config.retryCount).toBe(2);
    expect(scraper.config.timeout).toBe(15000);
  });
});
