import { describe, it, expect } from "vitest";
import {
  parseNewsRssItem,
  NewsRssScraper,
} from "@/lib/scrapers/community/news-rss";

describe("parseNewsRssItem", () => {
  it("parses a news RSS item correctly", () => {
    const item = {
      title: "Mobile Gaming Revenue Hits Record High",
      link: "https://www.pocketgamer.biz/article/12345",
      pubDate: "Mon, 20 Mar 2026 10:00:00 GMT",
      description: "The mobile gaming industry has reached a new milestone...",
    };

    const result = parseNewsRssItem(item);

    expect(result.source).toBe("news");
    expect(result.title).toBe("Mobile Gaming Revenue Hits Record High");
    expect(result.url).toBe("https://www.pocketgamer.biz/article/12345");
    expect(result.contentSummary).toBe(
      "The mobile gaming industry has reached a new milestone..."
    );
    expect(result.sentimentScore).toBeNull();
    expect(result.engagementScore).toBeNull();
    expect(result.date).toBe("Mon, 20 Mar 2026 10:00:00 GMT");
  });

  it("truncates description to 200 characters", () => {
    const longDescription = "A".repeat(300);
    const item = {
      title: "Test",
      link: "https://example.com/test",
      pubDate: "2026-03-20T12:00:00Z",
      description: longDescription,
    };

    const result = parseNewsRssItem(item);
    expect(result.contentSummary.length).toBe(200);
  });

  it("handles short descriptions without truncation", () => {
    const item = {
      title: "Short",
      link: "https://example.com/short",
      pubDate: "2026-03-20T12:00:00Z",
      description: "Brief news.",
    };

    const result = parseNewsRssItem(item);
    expect(result.contentSummary).toBe("Brief news.");
  });

  it("handles empty fields", () => {
    const item = {
      title: "",
      link: "",
      pubDate: "",
      description: "",
    };

    const result = parseNewsRssItem(item);
    expect(result.title).toBe("");
    expect(result.url).toBe("");
    expect(result.contentSummary).toBe("");
    expect(result.date).toBe("");
  });
});

describe("NewsRssScraper config", () => {
  it("has correct config values", () => {
    const scraper = new NewsRssScraper();
    expect(scraper.config.name).toBe("news-rss");
    expect(scraper.config.category).toBe("community");
    expect(scraper.config.rateLimit).toEqual({ requests: 1, perSeconds: 2 });
    expect(scraper.config.retryCount).toBe(2);
    expect(scraper.config.timeout).toBe(10000);
  });
});
