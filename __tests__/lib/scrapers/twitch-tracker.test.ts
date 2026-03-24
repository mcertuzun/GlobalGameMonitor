import { describe, it, expect } from "vitest";
import {
  parseTwitchData,
  TwitchTrackerScraper,
} from "@/lib/scrapers/community/twitch-tracker";

describe("parseTwitchData", () => {
  it("parses Twitch data correctly", () => {
    const raw = {
      gameName: "Clash Royale",
      currentViewers: 5000,
      peakViewers: 15000,
      avgViewers: 3500,
      hoursWatched: 120000,
    };

    const result = parseTwitchData(raw);

    expect(result.source).toBe("twitch");
    expect(result.title).toBe("Clash Royale");
    expect(result.contentSummary).toBe("Viewers: 5000, Peak: 15000");
    expect(result.sentimentScore).toBeNull();
    expect(result.engagementScore).toBe(5000);
    expect(result.date).toBeTruthy();
  });

  it("handles zero viewers", () => {
    const raw = {
      gameName: "Unknown Game",
      currentViewers: 0,
      peakViewers: 0,
      avgViewers: 0,
      hoursWatched: 0,
    };

    const result = parseTwitchData(raw);
    expect(result.engagementScore).toBe(0);
    expect(result.contentSummary).toBe("Viewers: 0, Peak: 0");
  });

  it("uses currentViewers as engagementScore", () => {
    const raw = {
      gameName: "Popular Game",
      currentViewers: 99999,
      peakViewers: 200000,
      avgViewers: 50000,
      hoursWatched: 5000000,
    };

    const result = parseTwitchData(raw);
    expect(result.engagementScore).toBe(99999);
  });
});

describe("TwitchTrackerScraper config", () => {
  it("has correct config values", () => {
    const scraper = new TwitchTrackerScraper();
    expect(scraper.config.name).toBe("twitch-tracker");
    expect(scraper.config.category).toBe("community");
    expect(scraper.config.rateLimit).toEqual({ requests: 1, perSeconds: 3 });
    expect(scraper.config.retryCount).toBe(2);
    expect(scraper.config.timeout).toBe(10000);
  });

  it("fetch returns empty records (stub)", async () => {
    const scraper = new TwitchTrackerScraper();
    const result = await scraper.fetch();
    expect(result.records).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.source).toBe("twitch-tracker");
  });
});
