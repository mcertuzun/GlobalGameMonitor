import { describe, it, expect } from "vitest";
import {
  parseTikTokAdResult,
  TikTokCreativeScraper,
} from "@/lib/scrapers/ads/tiktok-creative";

describe("parseTikTokAdResult", () => {
  it("parses a complete raw result with video URL", () => {
    const raw = {
      adId: "tt-001",
      advertiserName: "Mobile Games Studio",
      adText: "Download now and get 1000 gems free!",
      videoUrl: "https://tiktok.com/ad-video.mp4",
      thumbnailUrl: "https://tiktok.com/thumb.jpg",
      likes: 5000,
      firstSeen: "2026-02-20",
    };

    const result = parseTikTokAdResult(raw, "com.mobile.game");

    expect(result).toEqual({
      storeId: "com.mobile.game",
      platform: "tiktok",
      creativeType: "video",
      creativeUrl: "https://tiktok.com/ad-video.mp4",
      adCopy: "Download now and get 1000 gems free!",
      headline: "Mobile Games Studio",
      cta: "",
      firstSeen: "2026-02-20",
      isActive: true,
    });
  });

  it("falls back to thumbnailUrl when videoUrl is empty", () => {
    const raw = {
      adId: "tt-002",
      advertiserName: "Advertiser",
      adText: "Ad text",
      videoUrl: "",
      thumbnailUrl: "https://tiktok.com/thumb.jpg",
      likes: 100,
      firstSeen: "2026-01-01",
    };

    const result = parseTikTokAdResult(raw, "com.test.app");
    expect(result.creativeUrl).toBe("https://tiktok.com/thumb.jpg");
  });

  it("falls back to thumbnailUrl when videoUrl is undefined", () => {
    const raw = {
      adId: "tt-003",
      advertiserName: "Advertiser",
      adText: "Ad text",
      videoUrl: undefined as unknown as string,
      thumbnailUrl: "https://tiktok.com/thumb2.jpg",
      likes: 200,
      firstSeen: "2026-01-15",
    };

    const result = parseTikTokAdResult(raw, "com.test2.app");
    expect(result.creativeUrl).toBe("https://tiktok.com/thumb2.jpg");
  });

  it("handles all empty fields", () => {
    const raw = {
      adId: "",
      advertiserName: "",
      adText: "",
      videoUrl: "",
      thumbnailUrl: "",
      likes: 0,
      firstSeen: "",
    };

    const result = parseTikTokAdResult(raw, "com.empty.app");
    expect(result.storeId).toBe("com.empty.app");
    expect(result.platform).toBe("tiktok");
    expect(result.creativeType).toBe("video");
    expect(result.creativeUrl).toBe("");
    expect(result.adCopy).toBe("");
    expect(result.headline).toBe("");
    expect(result.cta).toBe("");
    expect(result.isActive).toBe(true);
  });
});

describe("TikTokCreativeScraper", () => {
  it("has correct config", () => {
    const scraper = new TikTokCreativeScraper();

    expect(scraper.config.name).toBe("tiktok-creative");
    expect(scraper.config.category).toBe("ads");
    expect(scraper.config.rateLimit).toEqual({ requests: 2, perSeconds: 30 });
    expect(scraper.config.retryCount).toBe(2);
    expect(scraper.config.timeout).toBe(30000);
  });

  it("fetch() returns empty records (stub)", async () => {
    const scraper = new TikTokCreativeScraper();
    const result = await scraper.fetch();

    expect(result.source).toBe("tiktok-creative");
    expect(result.records).toEqual([]);
    expect(result.errors).toEqual([]);
  });
});
