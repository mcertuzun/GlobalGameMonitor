import { describe, it, expect } from "vitest";
import {
  parseGPlayReview,
  parseAppStoreReview,
  ReviewsScraper,
} from "@/lib/scrapers/market/reviews";

describe("parseGPlayReview", () => {
  it("parses a full Google Play review", () => {
    const raw = {
      id: "gp-review-123",
      userName: "TestUser",
      date: "2026-03-20T12:00:00Z",
      score: 5,
      text: "Great game!",
      thumbsUpCount: 42,
      version: "2.1.0",
    };

    const result = parseGPlayReview(raw);

    expect(result.reviewId).toBe("gp-review-123");
    expect(result.userName).toBe("TestUser");
    expect(result.score).toBe(5);
    expect(result.text).toBe("Great game!");
    expect(result.thumbsUp).toBe(42);
    expect(result.version).toBe("2.1.0");
    expect(result.date).toBe("2026-03-20T12:00:00Z");
    expect(result.title).toBeNull();
  });

  it("handles missing optional fields with defaults", () => {
    const raw = {};

    const result = parseGPlayReview(raw);

    expect(result.reviewId).toBeNull();
    expect(result.userName).toBeNull();
    expect(result.score).toBe(0);
    expect(result.text).toBeNull();
    expect(result.thumbsUp).toBeNull();
    expect(result.version).toBeNull();
    expect(result.title).toBeNull();
  });

  it("handles null version field", () => {
    const raw = { version: null };

    const result = parseGPlayReview(raw);

    expect(result.version).toBeNull();
  });

  it("preserves low scores", () => {
    const raw = { score: 1 };

    const result = parseGPlayReview(raw);

    expect(result.score).toBe(1);
  });

  it("preserves zero thumbs up", () => {
    const raw = { thumbsUpCount: 0 };

    const result = parseGPlayReview(raw);

    expect(result.thumbsUp).toBe(0);
  });
});

describe("parseAppStoreReview", () => {
  it("parses a full App Store review", () => {
    const raw = {
      id: "as-review-456",
      userName: "iOSUser",
      date: "2026-03-19T08:00:00Z",
      score: 4,
      title: "Almost perfect",
      text: "Love the gameplay but needs more levels.",
      version: "3.0.1",
    };

    const result = parseAppStoreReview(raw);

    expect(result.reviewId).toBe("as-review-456");
    expect(result.userName).toBe("iOSUser");
    expect(result.score).toBe(4);
    expect(result.title).toBe("Almost perfect");
    expect(result.text).toBe("Love the gameplay but needs more levels.");
    expect(result.thumbsUp).toBeNull();
    expect(result.version).toBe("3.0.1");
    expect(result.date).toBe("2026-03-19T08:00:00Z");
  });

  it("handles missing optional fields with defaults", () => {
    const raw = {};

    const result = parseAppStoreReview(raw);

    expect(result.reviewId).toBeNull();
    expect(result.userName).toBeNull();
    expect(result.score).toBe(0);
    expect(result.title).toBeNull();
    expect(result.text).toBeNull();
    expect(result.thumbsUp).toBeNull();
    expect(result.version).toBeNull();
  });

  it("always returns null for thumbsUp (App Store has no thumbs up)", () => {
    const raw = {
      id: "test",
      score: 5,
      text: "Perfect!",
    };

    const result = parseAppStoreReview(raw);

    expect(result.thumbsUp).toBeNull();
  });
});

describe("ReviewsScraper config", () => {
  it("has correct config values", () => {
    const scraper = new ReviewsScraper();
    expect(scraper.config.name).toBe("reviews");
    expect(scraper.config.category).toBe("market");
    expect(scraper.config.rateLimit).toEqual({ requests: 1, perSeconds: 2 });
    expect(scraper.config.retryCount).toBe(2);
    expect(scraper.config.timeout).toBe(15000);
  });
});
