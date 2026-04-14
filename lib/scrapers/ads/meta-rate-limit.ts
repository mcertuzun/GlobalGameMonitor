/**
 * Rate-limit-aware fetch for the Meta Graph API. Meta signals throttling two
 * ways:
 *   1. HTTP 429 / 613 with a Retry-After header.
 *   2. X-App-Usage / X-Business-Use-Case-Usage headers reporting % of the
 *      hour-rolling quota consumed. When any dimension hits ~100%, the next
 *      call will start failing.
 *
 * This wrapper backs off on both signals so a batch scraper doesn't get its
 * token throttled. Backoff is exponential with jitter, capped at 32s.
 */

const BACKOFF_CAP_MS = 32_000;
const DEFAULT_MAX_ATTEMPTS = 5;
// If any rate-limit percentage exceeds this threshold, we proactively sleep
// for the retry-after duration even though the request succeeded.
const PROACTIVE_SLOWDOWN_PCT = 90;

export interface RateLimitAwareFetchOptions {
  maxAttempts?: number;
  /** Override for tests. */
  sleep?: (ms: number) => Promise<void>;
  /** Override for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export interface AppUsage {
  call_count?: number;
  total_cputime?: number;
  total_time?: number;
}

export function parseAppUsage(raw: string | null): AppUsage | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as AppUsage;
    return null;
  } catch {
    return null;
  }
}

/**
 * Max percentage across the X-App-Usage dimensions. Returns 0 when the header
 * is absent or unparseable.
 */
export function maxAppUsagePct(header: string | null): number {
  const usage = parseAppUsage(header);
  if (!usage) return 0;
  const values = [usage.call_count, usage.total_cputime, usage.total_time]
    .filter((v): v is number => typeof v === "number");
  return values.length === 0 ? 0 : Math.max(...values);
}

export function nextBackoffMs(attempt: number): number {
  // attempt is 1-indexed; 1 → 2s, 2 → 4s, 3 → 8s, 4 → 16s, 5 → 32s
  const base = Math.min(BACKOFF_CAP_MS, 2 ** attempt * 1000);
  // Add up to ±25% jitter so parallel callers don't hammer in sync.
  const jitter = base * 0.25 * (Math.random() * 2 - 1);
  return Math.max(500, Math.round(base + jitter));
}

/** Rate-limit / 429 aware wrapper around a Meta Graph API fetch. */
export async function fetchWithMetaBackoff(
  url: string | URL,
  init: RequestInit = {},
  opts: RateLimitAwareFetchOptions = {}
): Promise<Response> {
  const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const sleep =
    opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const fetchImpl = opts.fetchImpl ?? fetch;

  let lastResponse: Response | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const resp = await fetchImpl(url, init);
    lastResponse = resp;

    // 429 (or 613 — Meta's "rate limit exceeded" code) always retried.
    if (resp.status === 429 || resp.status === 613) {
      const retryAfter = Number(resp.headers.get("retry-after") ?? "0");
      const waitMs =
        retryAfter > 0
          ? Math.min(retryAfter * 1000, BACKOFF_CAP_MS)
          : nextBackoffMs(attempt);
      if (attempt < maxAttempts) {
        await sleep(waitMs);
        continue;
      }
      return resp;
    }

    // 5xx are worth retrying a couple times with backoff.
    if (resp.status >= 500 && resp.status < 600) {
      if (attempt < maxAttempts) {
        await sleep(nextBackoffMs(attempt));
        continue;
      }
      return resp;
    }

    // Success path. If we're close to the cap, proactively slow down so the
    // *next* call in the batch doesn't blow through.
    const pct = maxAppUsagePct(resp.headers.get("x-app-usage"));
    if (pct >= PROACTIVE_SLOWDOWN_PCT) {
      await sleep(nextBackoffMs(1));
    }
    return resp;
  }

  // Fallback — should be unreachable because each branch either continues or returns.
  return lastResponse ?? new Response(null, { status: 500 });
}
