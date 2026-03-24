import { describe, it, expect } from "vitest";
import {
  parseRedditRssEntry,
  RedditScraper,
} from "@/lib/scrapers/community/reddit";

describe("parseRedditRssEntry", () => {
  it("parses a Reddit RSS entry correctly", () => {
    const entry = {
      title: "Best mobile games 2026?",
      link: "https://www.reddit.com/r/AndroidGaming/comments/abc123",
      published: "2026-03-20T12:00:00Z",
      score: 42,
    };

    const result = parseRedditRssEntry(entry);

    expect(result.source).toBe("reddit");
    expect(result.title).toBe("Best mobile games 2026?");
    expect(result.url).toBe(
      "https://www.reddit.com/r/AndroidGaming/comments/abc123"
    );
    expect(result.contentSummary).toBe("Best mobile games 2026?");
    expect(result.sentimentScore).toBeNull();
    expect(result.engagementScore).toBe(42);
    expect(result.date).toBe("2026-03-20T12:00:00Z");
  });

  it("handles zero score", () => {
    const entry = {
      title: "New game announcement",
      link: "https://www.reddit.com/r/iosgaming/comments/xyz",
      published: "2026-03-18T08:30:00Z",
      score: 0,
    };

    const result = parseRedditRssEntry(entry);
    expect(result.engagementScore).toBe(0);
  });

  it("preserves empty strings", () => {
    const entry = {
      title: "",
      link: "",
      published: "",
      score: 0,
    };

    const result = parseRedditRssEntry(entry);
    expect(result.title).toBe("");
    expect(result.url).toBe("");
    expect(result.contentSummary).toBe("");
  });
});

describe("RedditScraper config", () => {
  it("has correct config values", () => {
    const scraper = new RedditScraper();
    expect(scraper.config.name).toBe("reddit");
    expect(scraper.config.category).toBe("community");
    expect(scraper.config.rateLimit).toEqual({ requests: 1, perSeconds: 2 });
    expect(scraper.config.retryCount).toBe(2);
    expect(scraper.config.timeout).toBe(10000);
  });
});
