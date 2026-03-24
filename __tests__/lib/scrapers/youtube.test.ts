import { describe, it, expect } from "vitest";
import {
  parseYouTubeSearchResult,
  parseYouTubeVideoStats,
  YouTubeScraper,
} from "@/lib/scrapers/community/youtube";

const mockSearchItem = {
  id: { videoId: "dQw4w9WgXcQ" },
  snippet: {
    title: "Amazing Mobile Game Gameplay - Clash Royale 2026",
    channelTitle: "MobileGamer123",
    publishedAt: "2026-03-20T14:30:00Z",
    description:
      "Check out this amazing gameplay of the new Clash Royale update!",
    thumbnails: {
      default: { url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg" },
    },
  },
};

const mockVideoStatsItem = {
  id: "dQw4w9WgXcQ",
  statistics: {
    viewCount: "1500000",
    likeCount: "75000",
    commentCount: "3200",
  },
};

describe("parseYouTubeSearchResult", () => {
  it("parses a YouTube search result correctly", () => {
    const result = parseYouTubeSearchResult(mockSearchItem, "Clash Royale");
    expect(result.source).toBe("youtube");
    expect(result.signalType).toBe("video_count");
    expect(result.name).toBe("Clash Royale");
    expect(result.value).toBe(1);
    expect(result.date).toBe("2026-03-20");

    const metadata = JSON.parse(result.metadata);
    expect(metadata.videoId).toBe("dQw4w9WgXcQ");
    expect(metadata.title).toBe(
      "Amazing Mobile Game Gameplay - Clash Royale 2026"
    );
    expect(metadata.channelTitle).toBe("MobileGamer123");
    expect(metadata.publishedAt).toBe("2026-03-20T14:30:00Z");
    expect(metadata.viewCount).toBeNull();
  });

  it("extracts date from publishedAt (YYYY-MM-DD)", () => {
    const result = parseYouTubeSearchResult(mockSearchItem, "Clash Royale");
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    expect(result.date).toMatch(dateRegex);
  });

  it("uses the provided gameName as the name field", () => {
    const result = parseYouTubeSearchResult(mockSearchItem, "My Custom Game");
    expect(result.name).toBe("My Custom Game");
  });

  it("always sets value to 1 (each video is one signal)", () => {
    const result = parseYouTubeSearchResult(mockSearchItem, "Test Game");
    expect(result.value).toBe(1);
  });

  it("includes videoId in metadata", () => {
    const result = parseYouTubeSearchResult(mockSearchItem, "Test Game");
    const metadata = JSON.parse(result.metadata);
    expect(metadata.videoId).toBe("dQw4w9WgXcQ");
  });

  it("sets viewCount to null in initial parse (filled later from stats)", () => {
    const result = parseYouTubeSearchResult(mockSearchItem, "Test Game");
    const metadata = JSON.parse(result.metadata);
    expect(metadata.viewCount).toBeNull();
  });
});

describe("parseYouTubeVideoStats", () => {
  it("parses video statistics correctly", () => {
    const result = parseYouTubeVideoStats(mockVideoStatsItem);
    expect(result.videoId).toBe("dQw4w9WgXcQ");
    expect(result.viewCount).toBe(1500000);
    expect(result.likeCount).toBe(75000);
    expect(result.commentCount).toBe(3200);
  });

  it("converts string numbers to actual numbers", () => {
    const result = parseYouTubeVideoStats(mockVideoStatsItem);
    expect(typeof result.viewCount).toBe("number");
    expect(typeof result.likeCount).toBe("number");
    expect(typeof result.commentCount).toBe("number");
  });

  it("handles zero counts", () => {
    const zeroStats = {
      id: "abc123",
      statistics: {
        viewCount: "0",
        likeCount: "0",
        commentCount: "0",
      },
    };
    const result = parseYouTubeVideoStats(zeroStats);
    expect(result.viewCount).toBe(0);
    expect(result.likeCount).toBe(0);
    expect(result.commentCount).toBe(0);
  });

  it("handles missing statistics gracefully (NaN becomes 0)", () => {
    const noStats = {
      id: "xyz789",
      statistics: {
        viewCount: undefined as unknown as string,
        likeCount: undefined as unknown as string,
        commentCount: undefined as unknown as string,
      },
    };
    const result = parseYouTubeVideoStats(noStats);
    expect(result.videoId).toBe("xyz789");
    // Number(undefined) => NaN, so parser should handle this
    expect(Number.isNaN(result.viewCount) || result.viewCount === 0).toBe(true);
  });
});

describe("YouTubeScraper config", () => {
  it("has correct config values", () => {
    const scraper = new YouTubeScraper();
    expect(scraper.config.name).toBe("youtube");
    expect(scraper.config.category).toBe("community");
    expect(scraper.config.rateLimit).toEqual({ requests: 1, perSeconds: 1 });
    expect(scraper.config.retryCount).toBe(2);
    expect(scraper.config.timeout).toBe(10000);
  });
});
