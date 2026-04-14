import { db } from "@/lib/db/client";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// ── Chart discovery config ─────────────────────────────────────────────
//
// Drives the top-chart scrapers: which stores/countries/chart-types to pull,
// how deep to go, and what counts as a "sudden riser". Stored as a single
// JSON blob under the `chart_config` key so it can be edited via the Settings
// page without a redeploy.

export interface ChartConfig {
  countries: string[];       // ISO-2 codes, applied to both stores
  chartTypes: string[];      // "free" | "paid" | "grossing"
  category: "games" | "apps";
  topN: number;              // how many ranks to pull per chart
  rising: {
    lookbackDays: number;    // compare today vs. N days ago
    minJump: number;         // min rank delta to qualify as rising
    topN: number;            // how many risers to surface
    includeNewEntries: boolean; // games that weren't in the list N days ago
  };
}

export const DEFAULT_CHART_CONFIG: ChartConfig = {
  countries: ["US", "GB", "DE", "TR", "BR", "JP", "KR"],
  chartTypes: ["free"],
  category: "games",
  topN: 300,
  rising: {
    lookbackDays: 7,
    minJump: 20,
    topN: 200,
    includeNewEntries: true,
  },
};

const SETTINGS_KEY = "chart_config";

function mergeWithDefaults(partial: Partial<ChartConfig> | null): ChartConfig {
  if (!partial) return DEFAULT_CHART_CONFIG;
  return {
    ...DEFAULT_CHART_CONFIG,
    ...partial,
    rising: {
      ...DEFAULT_CHART_CONFIG.rising,
      ...(partial.rising ?? {}),
    },
  };
}

export async function getChartConfig(): Promise<ChartConfig> {
  try {
    const row = await db
      .select()
      .from(settings)
      .where(eq(settings.key, SETTINGS_KEY))
      .limit(1);

    if (row.length === 0) return DEFAULT_CHART_CONFIG;

    const parsed = JSON.parse(row[0].value) as Partial<ChartConfig>;
    return mergeWithDefaults(parsed);
  } catch {
    return DEFAULT_CHART_CONFIG;
  }
}

export async function setChartConfig(next: Partial<ChartConfig>): Promise<ChartConfig> {
  const merged = mergeWithDefaults(next);
  const now = new Date().toISOString();
  const value = JSON.stringify(merged);

  const existing = await db
    .select()
    .from(settings)
    .where(eq(settings.key, SETTINGS_KEY))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(settings)
      .set({ value, updatedAt: now })
      .where(eq(settings.key, SETTINGS_KEY));
  } else {
    await db.insert(settings).values({
      key: SETTINGS_KEY,
      value,
      updatedAt: now,
    });
  }

  return merged;
}
