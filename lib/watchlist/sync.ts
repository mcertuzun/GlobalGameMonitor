import { db } from "@/lib/db/client";
import { apps, topCharts } from "@/lib/db/schema";
import { eq, and, inArray, gte, or } from "drizzle-orm";
import { getChartConfig } from "@/lib/settings/chart-config";

/**
 * Keeps the `apps.trackAds` watchlist in sync with whichever games appear in
 * top grossing and top free charts over the recent lookback window. Idempotent.
 *
 * - Own games stay on the list forever (`trackAds=true`, reason="own-game").
 * - Manually flagged apps (reason="manual") never get overwritten.
 * - Auto entries get refreshed from today's charts; anything that fell off the
 *   chart for longer than `retentionDays` gets removed.
 */

export interface SyncConfig {
  topFreeRank: number;        // keep if seen at or above this rank in top-free
  topGrossingRank: number;    // keep if seen at or above this rank in top-grossing
  retentionDays: number;      // how long an off-chart app stays on the watchlist
}

export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  topFreeRank: 300,
  topGrossingRank: 200,
  retentionDays: 14,
};

export interface SyncReport {
  added: number;
  kept: number;
  removed: number;
  reasons: Record<string, number>;
}

export async function syncWatchlist(
  cfg: Partial<SyncConfig> = {}
): Promise<SyncReport> {
  const sync = { ...DEFAULT_SYNC_CONFIG, ...cfg };
  const chartCfg = await getChartConfig();

  const today = new Date();
  const freshCutoff = new Date(today);
  freshCutoff.setUTCDate(freshCutoff.getUTCDate() - sync.retentionDays);
  const freshCutoffStr = freshCutoff.toISOString().slice(0, 10);

  // Pull every (appId, chartType, rank) seen within the retention window, so
  // an app that dropped yesterday still counts as "current".
  const recent = await db
    .select({
      appId: topCharts.appId,
      chartType: topCharts.chartType,
      rank: topCharts.rank,
      date: topCharts.date,
    })
    .from(topCharts)
    .where(
      and(
        gte(topCharts.date, freshCutoffStr),
        eq(topCharts.category, chartCfg.category)
      )
    );

  // Reduce to best rank seen per (appId, chartType).
  const bestRank = new Map<string, number>();
  for (const row of recent) {
    const key = `${row.appId}|${row.chartType}`;
    const prev = bestRank.get(key);
    if (prev === undefined || row.rank < prev) bestRank.set(key, row.rank);
  }

  const qualifying = new Map<number, "top-free" | "top-grossing" | "top-paid">();
  for (const [key, rank] of bestRank) {
    const [appIdStr, chartType] = key.split("|");
    const appId = Number(appIdStr);
    if (chartType === "free" && rank <= sync.topFreeRank) {
      qualifying.set(appId, "top-free");
    } else if (chartType === "grossing" && rank <= sync.topGrossingRank) {
      // Prefer grossing over free when both match — it's a stronger signal.
      qualifying.set(appId, "top-grossing");
    } else if (chartType === "paid" && rank <= sync.topFreeRank && !qualifying.has(appId)) {
      qualifying.set(appId, "top-paid");
    }
  }

  const reasons: Record<string, number> = {};
  let added = 0;
  let kept = 0;
  let removed = 0;

  // 1) Own games — always on.
  const ownRows = await db
    .select({ id: apps.id, trackAds: apps.trackAds })
    .from(apps)
    .where(eq(apps.isOwnGame, true));
  for (const r of ownRows) {
    if (!r.trackAds) {
      await db
        .update(apps)
        .set({ trackAds: true, watchlistReason: "own-game" })
        .where(eq(apps.id, r.id));
      added += 1;
    } else {
      kept += 1;
    }
    reasons["own-game"] = (reasons["own-game"] ?? 0) + 1;
  }

  // 2) Auto-qualifying apps from charts.
  if (qualifying.size > 0) {
    const ids = Array.from(qualifying.keys());
    const existing = await db
      .select({
        id: apps.id,
        trackAds: apps.trackAds,
        watchlistReason: apps.watchlistReason,
      })
      .from(apps)
      .where(inArray(apps.id, ids));

    const existingById = new Map(existing.map((r) => [r.id, r]));

    for (const [appId, reason] of qualifying) {
      const row = existingById.get(appId);
      if (!row) continue; // app was deleted between snapshots
      // Preserve manual overrides.
      if (row.watchlistReason === "manual" || row.watchlistReason === "own-game") {
        kept += 1;
        reasons[row.watchlistReason] = (reasons[row.watchlistReason] ?? 0) + 1;
        continue;
      }
      if (row.trackAds && row.watchlistReason === reason) {
        kept += 1;
      } else {
        await db
          .update(apps)
          .set({ trackAds: true, watchlistReason: reason })
          .where(eq(apps.id, appId));
        added += 1;
      }
      reasons[reason] = (reasons[reason] ?? 0) + 1;
    }
  }

  // 3) Remove stale auto entries — no chart appearance within retention window.
  const qualifyingIds = Array.from(qualifying.keys());
  const staleConditions = [
    eq(apps.trackAds, true),
    or(
      eq(apps.watchlistReason, "top-free"),
      eq(apps.watchlistReason, "top-grossing"),
      eq(apps.watchlistReason, "top-paid")
    )!,
  ];
  const stale = await db
    .select({ id: apps.id })
    .from(apps)
    .where(and(...staleConditions));

  const qualifyingSet = new Set(qualifyingIds);
  for (const row of stale) {
    if (qualifyingSet.has(row.id)) continue;
    await db
      .update(apps)
      .set({ trackAds: false, watchlistReason: null })
      .where(eq(apps.id, row.id));
    removed += 1;
  }

  return { added, kept, removed, reasons };
}
