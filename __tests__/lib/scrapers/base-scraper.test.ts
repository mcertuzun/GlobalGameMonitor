import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BaseScraper, ScraperConfig, ScraperResult } from "@/lib/scrapers/base-scraper";

// Concrete test implementation
class TestScraper extends BaseScraper<{ value: number }> {
  config: ScraperConfig = {
    name: "test-scraper",
    category: "market",
    rateLimit: { requests: 2, perSeconds: 1 },
    retryCount: 3,
    timeout: 5000,
  };

  fetchFn = vi.fn<() => Promise<ScraperResult<{ value: number }>>>();
  storeFn = vi.fn<(records: { value: number }[]) => Promise<void>>();

  async fetch(): Promise<ScraperResult<{ value: number }>> {
    return this.fetchFn();
  }

  async store(records: { value: number }[]): Promise<void> {
    return this.storeFn(records);
  }
}

describe("BaseScraper", () => {
  let scraper: TestScraper;

  beforeEach(() => {
    vi.useFakeTimers();
    scraper = new TestScraper();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should run fetch and store on successful execution", async () => {
    scraper.fetchFn.mockResolvedValue({
      source: "test",
      fetchedAt: new Date(),
      records: [{ value: 1 }, { value: 2 }],
      errors: [],
    });
    scraper.storeFn.mockResolvedValue(undefined);

    const result = await scraper.run();

    expect(result.status).toBe("success");
    expect(result.recordsFetched).toBe(2);
    expect(scraper.fetchFn).toHaveBeenCalledOnce();
    expect(scraper.storeFn).toHaveBeenCalledWith([{ value: 1 }, { value: 2 }]);
  });

  it("should retry on fetch failure", async () => {
    scraper.fetchFn
      .mockRejectedValueOnce(new Error("Network error"))
      .mockRejectedValueOnce(new Error("Timeout"))
      .mockResolvedValue({
        source: "test",
        fetchedAt: new Date(),
        records: [{ value: 1 }],
        errors: [],
      });
    scraper.storeFn.mockResolvedValue(undefined);

    const runPromise = scraper.run();

    // Advance past backoff timers: attempt 1 backoff = 1000ms, attempt 2 backoff = 2000ms
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);

    const result = await runPromise;

    expect(result.status).toBe("success");
    expect(scraper.fetchFn).toHaveBeenCalledTimes(3);
  });

  it("should return error after all retries fail", async () => {
    scraper.fetchFn.mockRejectedValue(new Error("Persistent error"));

    const runPromise = scraper.run();

    // Advance past all backoff timers: 1000ms + 2000ms
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);

    const result = await runPromise;

    expect(result.status).toBe("error");
    expect(result.error).toContain("Persistent error");
    expect(scraper.fetchFn).toHaveBeenCalledTimes(3);
  });

  it("should collect errors from fetch result", async () => {
    scraper.fetchFn.mockResolvedValue({
      source: "test",
      fetchedAt: new Date(),
      records: [{ value: 1 }],
      errors: ["Warning: partial data"],
    });
    scraper.storeFn.mockResolvedValue(undefined);

    const result = await scraper.run();

    expect(result.status).toBe("success");
    expect(result.errors).toContain("Warning: partial data");
  });
});
