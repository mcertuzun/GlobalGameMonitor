import { describe, it, expect } from "vitest";
import { GooglePlayTopChartsScraper } from "@/lib/scrapers/market/google-play-top-charts";

describe("GooglePlayTopChartsScraper", () => {
  it("has correct config", () => {
    const scraper = new GooglePlayTopChartsScraper();
    expect(scraper.config.name).toBe("google-play-top-charts");
    expect(scraper.config.category).toBe("market");
  });
});
