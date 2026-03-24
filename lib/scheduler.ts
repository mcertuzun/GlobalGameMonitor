import { db } from "@/lib/db/client";
import { scraperRuns, settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getAllScrapers } from "@/lib/scrapers/registry";
import type { BaseScraper } from "@/lib/scrapers/base-scraper";

// ── Schedule definitions ────────────────────────────────────────────────
// Maps scraper categories (and special overrides) to intervals in ms.
// "sdk" is a special key for appbrain-sdk (which has category "ads" but
// runs on a weekly cadence per requirements).

interface ScheduleDef {
  label: string;
  intervalMs: number;
  intervalLabel: string;
  match: (scraper: BaseScraper<unknown>) => boolean;
}

const SCHEDULE_DEFS: ScheduleDef[] = [
  {
    label: "Market Data",
    intervalMs: 6 * 60 * 60 * 1000, // 6 hours
    intervalLabel: "Every 6 hours",
    match: (s) => s.config.category === "market",
  },
  {
    label: "SDK Intelligence",
    intervalMs: 7 * 24 * 60 * 60 * 1000, // weekly
    intervalLabel: "Weekly",
    match: (s) => s.config.name === "appbrain-sdk",
  },
  {
    label: "Ad Scrapers",
    intervalMs: 12 * 60 * 60 * 1000, // 12 hours
    intervalLabel: "Every 12 hours",
    // ads category, excluding appbrain-sdk which has its own schedule
    match: (s) => s.config.category === "ads" && s.config.name !== "appbrain-sdk",
  },
  {
    label: "Community",
    intervalMs: 4 * 60 * 60 * 1000, // 4 hours
    intervalLabel: "Every 4 hours",
    match: (s) => s.config.category === "community",
  },
  {
    label: "Competitor",
    intervalMs: 24 * 60 * 60 * 1000, // daily
    intervalLabel: "Daily",
    match: (s) => s.config.category === "competitor",
  },
];

// ── State ───────────────────────────────────────────────────────────────

let intervals: ReturnType<typeof setInterval>[] = [];
let isRunning = false;
const startTimes = new Map<string, number>(); // category label -> start timestamp

// ── Run a single scraper with logging ──────────────────────────────────

async function runScraper(scraper: BaseScraper<unknown>): Promise<void> {
  const now = new Date().toISOString();
  let runId: number;

  try {
    const [run] = await db
      .insert(scraperRuns)
      .values({
        scraperName: scraper.config.name,
        startedAt: now,
        status: "running",
      })
      .returning({ id: scraperRuns.id });
    runId = run.id;
  } catch {
    console.error(`[scheduler] Failed to insert scraper_runs for ${scraper.config.name}`);
    return;
  }

  try {
    const result = await scraper.run();
    await db
      .update(scraperRuns)
      .set({
        status: result.status,
        recordsFetched: result.recordsFetched,
        finishedAt: new Date().toISOString(),
        errorMessage: result.error ?? null,
      })
      .where(eq(scraperRuns.id, runId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .update(scraperRuns)
      .set({
        status: "error",
        finishedAt: new Date().toISOString(),
        errorMessage: msg,
      })
      .where(eq(scraperRuns.id, runId))
      .catch(() => {}); // swallow DB errors in error path
  }
}

// ── Run all scrapers matching a schedule definition ─────────────────────

async function runCategory(def: ScheduleDef): Promise<void> {
  const scrapers = getAllScrapers().filter(def.match);
  console.log(
    `[scheduler] Running ${def.label} (${scrapers.length} scrapers)`
  );

  for (const scraper of scrapers) {
    try {
      await runScraper(scraper);
    } catch (err) {
      // Catch-all so one failure doesn't stop others
      console.error(
        `[scheduler] Unhandled error in ${scraper.config.name}:`,
        err
      );
    }
  }
}

// ── Public API ──────────────────────────────────────────────────────────

export function startScheduler(): void {
  if (isRunning) return;
  isRunning = true;

  const now = Date.now();

  for (const def of SCHEDULE_DEFS) {
    startTimes.set(def.label, now);

    const id = setInterval(() => {
      startTimes.set(def.label, Date.now());
      runCategory(def).catch((err) => {
        console.error(`[scheduler] Error running ${def.label}:`, err);
      });
    }, def.intervalMs);

    intervals.push(id);
  }

  console.log("[scheduler] Started");
}

export function stopScheduler(): void {
  intervals.forEach(clearInterval);
  intervals = [];
  startTimes.clear();
  isRunning = false;
  console.log("[scheduler] Stopped");
}

export function isSchedulerRunning(): boolean {
  return isRunning;
}

export interface ScheduleInfo {
  category: string;
  intervalHours: number;
  intervalLabel: string;
  scrapers: string[];
  nextRun: string | null;
}

export function getScheduleInfo(): ScheduleInfo[] {
  const allScrapers = getAllScrapers();

  return SCHEDULE_DEFS.map((def) => {
    const matched = allScrapers.filter(def.match);
    const lastStart = startTimes.get(def.label);
    let nextRun: string | null = null;

    if (isRunning && lastStart) {
      const nextMs = lastStart + def.intervalMs;
      nextRun = new Date(nextMs).toISOString();
    }

    return {
      category: def.label,
      intervalHours: def.intervalMs / (60 * 60 * 1000),
      intervalLabel: def.intervalLabel,
      scrapers: matched.map((s) => s.config.name),
      nextRun,
    };
  });
}

// ── Persistence helpers ─────────────────────────────────────────────────

const SETTINGS_KEY = "scheduler_enabled";

export async function persistSchedulerState(enabled: boolean): Promise<void> {
  await db
    .insert(settings)
    .values({
      key: SETTINGS_KEY,
      value: enabled ? "true" : "false",
      updatedAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: settings.key,
      set: {
        value: enabled ? "true" : "false",
        updatedAt: new Date().toISOString(),
      },
    });
}

export async function getPersistedSchedulerState(): Promise<boolean> {
  const row = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, SETTINGS_KEY))
    .limit(1);
  return row.length > 0 && row[0].value === "true";
}

// ── Init (called on server start) ──────────────────────────────────────

export async function initScheduler(): Promise<void> {
  try {
    const enabled = await getPersistedSchedulerState();
    if (enabled) {
      startScheduler();
    }
  } catch {
    // settings table might not exist yet on first run before migration
    // — safe to ignore
  }
}
