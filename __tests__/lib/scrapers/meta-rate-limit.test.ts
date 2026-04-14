import { describe, it, expect, vi } from "vitest";
import {
  fetchWithMetaBackoff,
  maxAppUsagePct,
  nextBackoffMs,
  parseAppUsage,
} from "@/lib/scrapers/ads/meta-rate-limit";

describe("parseAppUsage", () => {
  it("parses the x-app-usage header", () => {
    const u = parseAppUsage(
      '{"call_count":42,"total_cputime":10,"total_time":30}'
    );
    expect(u?.call_count).toBe(42);
  });

  it("returns null on invalid JSON", () => {
    expect(parseAppUsage("not-json")).toBeNull();
    expect(parseAppUsage(null)).toBeNull();
  });
});

describe("maxAppUsagePct", () => {
  it("returns the highest dimension", () => {
    expect(
      maxAppUsagePct('{"call_count":50,"total_cputime":95,"total_time":12}')
    ).toBe(95);
  });

  it("returns 0 when header is absent or empty", () => {
    expect(maxAppUsagePct(null)).toBe(0);
    expect(maxAppUsagePct("{}")).toBe(0);
  });
});

describe("nextBackoffMs", () => {
  it("grows exponentially up to a 32s cap", () => {
    const a = nextBackoffMs(1);
    const b = nextBackoffMs(2);
    const c = nextBackoffMs(5);
    expect(a).toBeGreaterThanOrEqual(500);
    expect(b).toBeGreaterThan(a / 2); // grows with attempt
    expect(c).toBeLessThanOrEqual(32_000 * 1.25 + 100);
  });
});

describe("fetchWithMetaBackoff", () => {
  it("retries on 429 until success", async () => {
    const sleep = vi.fn(async () => {});
    let attempts = 0;
    const fetchImpl = vi.fn(async () => {
      attempts += 1;
      if (attempts < 3) {
        return new Response("rate limited", {
          status: 429,
          headers: { "retry-after": "1" },
        });
      }
      return new Response("{}", { status: 200 });
    });
    const resp = await fetchWithMetaBackoff(
      "https://example.com",
      {},
      { fetchImpl: fetchImpl as unknown as typeof fetch, sleep, maxAttempts: 5 }
    );
    expect(resp.status).toBe(200);
    expect(attempts).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("retries on 5xx", async () => {
    const sleep = vi.fn(async () => {});
    let attempts = 0;
    const fetchImpl = vi.fn(async () => {
      attempts += 1;
      if (attempts === 1) return new Response("oops", { status: 503 });
      return new Response("ok", { status: 200 });
    });
    const resp = await fetchWithMetaBackoff(
      "https://example.com",
      {},
      { fetchImpl: fetchImpl as unknown as typeof fetch, sleep }
    );
    expect(resp.status).toBe(200);
    expect(attempts).toBe(2);
  });

  it("proactively sleeps when usage is high but request succeeded", async () => {
    const sleep = vi.fn(async () => {});
    const fetchImpl = vi.fn(async () => {
      return new Response("{}", {
        status: 200,
        headers: {
          "x-app-usage":
            '{"call_count":95,"total_cputime":10,"total_time":10}',
        },
      });
    });
    const resp = await fetchWithMetaBackoff(
      "https://example.com",
      {},
      { fetchImpl: fetchImpl as unknown as typeof fetch, sleep }
    );
    expect(resp.status).toBe(200);
    expect(sleep).toHaveBeenCalledTimes(1); // proactive slowdown
  });

  it("does not sleep on healthy responses", async () => {
    const sleep = vi.fn(async () => {});
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    await fetchWithMetaBackoff(
      "https://example.com",
      {},
      { fetchImpl: fetchImpl as unknown as typeof fetch, sleep }
    );
    expect(sleep).not.toHaveBeenCalled();
  });

  it("stops retrying and returns the last 429 when attempts exhausted", async () => {
    const sleep = vi.fn(async () => {});
    const fetchImpl = vi.fn(async () =>
      new Response("still limited", { status: 429 })
    );
    const resp = await fetchWithMetaBackoff(
      "https://example.com",
      {},
      { fetchImpl: fetchImpl as unknown as typeof fetch, sleep, maxAttempts: 3 }
    );
    expect(resp.status).toBe(429);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
