import { describe, it, expect } from "vitest";
import {
  parseGoogleAdResult,
  GoogleAdsTransparencyScraper,
} from "@/lib/scrapers/ads/google-ads-transparency";

describe("parseGoogleAdResult", () => {
  it("parses a complete raw result", () => {
    const raw = {
      adId: "ad-123",
      advertiserName: "Cool Games Inc.",
      creativeContent: "Play the best RPG of 2026!",
      format: "video",
      firstShown: "2026-01-15",
      lastShown: "2026-03-01",
      imageUrl: "https://example.com/ad.png",
    };

    const result = parseGoogleAdResult(raw, "com.cool.game");

    expect(result).toEqual({
      storeId: "com.cool.game",
      platform: "google",
      creativeType: "video",
      creativeUrl: "https://example.com/ad.png",
      adCopy: "Play the best RPG of 2026!",
      headline: "Cool Games Inc.",
      cta: "",
      firstSeen: "2026-01-15",
      isActive: true,
    });
  });

  it("defaults creativeType to 'image' when format is empty", () => {
    const raw = {
      adId: "ad-456",
      advertiserName: "Some Advertiser",
      creativeContent: "Ad text",
      format: "",
      firstShown: "2026-02-01",
      lastShown: "2026-02-15",
      imageUrl: "https://example.com/img.jpg",
    };

    const result = parseGoogleAdResult(raw, "com.some.app");
    expect(result.creativeType).toBe("image");
  });

  it("defaults creativeType to 'image' when format is undefined", () => {
    const raw = {
      adId: "ad-789",
      advertiserName: "Advertiser",
      creativeContent: "Content",
      format: undefined as unknown as string,
      firstShown: "2026-03-01",
      lastShown: "2026-03-15",
      imageUrl: "https://example.com/img2.jpg",
    };

    const result = parseGoogleAdResult(raw, "com.another.app");
    expect(result.creativeType).toBe("image");
  });

  it("handles empty string fields", () => {
    const raw = {
      adId: "",
      advertiserName: "",
      creativeContent: "",
      format: "",
      firstShown: "",
      lastShown: "",
      imageUrl: "",
    };

    const result = parseGoogleAdResult(raw, "com.test.app");
    expect(result.storeId).toBe("com.test.app");
    expect(result.platform).toBe("google");
    expect(result.creativeType).toBe("image");
    expect(result.creativeUrl).toBe("");
    expect(result.adCopy).toBe("");
    expect(result.headline).toBe("");
    expect(result.cta).toBe("");
    expect(result.isActive).toBe(true);
  });
});

describe("GoogleAdsTransparencyScraper", () => {
  it("has correct config", () => {
    const scraper = new GoogleAdsTransparencyScraper();

    expect(scraper.config.name).toBe("google-ads-transparency");
    expect(scraper.config.category).toBe("ads");
    expect(scraper.config.rateLimit).toEqual({ requests: 2, perSeconds: 30 });
    expect(scraper.config.retryCount).toBe(2);
    expect(scraper.config.timeout).toBe(30000);
  });

  it("fetch() returns empty records (stub)", async () => {
    const scraper = new GoogleAdsTransparencyScraper();
    const result = await scraper.fetch();

    expect(result.source).toBe("google-ads-transparency");
    expect(result.records).toEqual([]);
    expect(result.errors).toEqual([]);
  });
});
