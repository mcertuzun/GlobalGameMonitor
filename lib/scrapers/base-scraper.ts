export interface ScraperConfig {
  name: string;
  category: "market" | "competitor" | "ads" | "community";
  rateLimit: { requests: number; perSeconds: number };
  retryCount: number;
  timeout: number;
}

export interface ScraperResult<T> {
  source: string;
  fetchedAt: Date;
  records: T[];
  errors: string[];
}

export interface ScraperRunResult {
  status: "success" | "error";
  recordsFetched: number;
  error?: string;
  errors: string[];
  durationMs: number;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export abstract class BaseScraper<T> {
  abstract config: ScraperConfig;
  abstract fetch(): Promise<ScraperResult<T>>;
  abstract store(records: T[]): Promise<void>;

  /** Enforce rate limit delay between scraper runs */
  protected async rateLimit(): Promise<void> {
    const { requests, perSeconds } = this.config.rateLimit;
    const delayMs = (perSeconds / requests) * 1000;
    await sleep(delayMs);
  }

  async run(): Promise<ScraperRunResult> {
    const startTime = Date.now();
    const allErrors: string[] = [];

    for (let attempt = 1; attempt <= this.config.retryCount; attempt++) {
      try {
        const result = await this.fetch();
        allErrors.push(...result.errors);

        if (result.records.length > 0) {
          await this.store(result.records);
        }

        return {
          status: "success",
          recordsFetched: result.records.length,
          errors: allErrors,
          durationMs: Date.now() - startTime,
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        allErrors.push(`Attempt ${attempt}: ${errorMsg}`);

        if (attempt < this.config.retryCount) {
          const backoff = Math.pow(2, attempt - 1) * 1000;
          await sleep(backoff);
        } else {
          return {
            status: "error",
            recordsFetched: 0,
            error: errorMsg,
            errors: allErrors,
            durationMs: Date.now() - startTime,
          };
        }
      }
    }

    return {
      status: "error",
      recordsFetched: 0,
      error: "Unknown error",
      errors: allErrors,
      durationMs: Date.now() - startTime,
    };
  }
}
