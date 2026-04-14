import { describe, it, expect } from "vitest";
import {
  detectRisingGames,
  type ChartSnapshotRow,
} from "@/lib/analytics/rising-games";

const REFERENCE = new Date("2026-04-14T00:00:00Z");

function row(
  overrides: Partial<ChartSnapshotRow> &
    Pick<ChartSnapshotRow, "appId" | "appName" | "rank" | "date" | "country">
): ChartSnapshotRow {
  return {
    iconUrl: null,
    store: "playstore",
    chartType: "free",
    ...overrides,
  };
}

describe("detectRisingGames", () => {
  const cfg = {
    lookbackDays: 7,
    minJump: 20,
    topN: 10,
    includeNewEntries: true,
  };

  it("flags a game that jumped significantly in rank", () => {
    const rows: ChartSnapshotRow[] = [
      row({ appId: 1, appName: "Climber", country: "US", rank: 200, date: "2026-04-07" }),
      row({ appId: 1, appName: "Climber", country: "US", rank: 15, date: "2026-04-14" }),
    ];
    const result = detectRisingGames(rows, cfg, REFERENCE);
    expect(result).toHaveLength(1);
    expect(result[0].appId).toBe(1);
    expect(result[0].rankDelta).toBe(185);
    expect(result[0].isNewEntry).toBe(false);
  });

  it("skips games that dropped or stayed flat", () => {
    const rows: ChartSnapshotRow[] = [
      row({ appId: 2, appName: "Flat", country: "US", rank: 50, date: "2026-04-07" }),
      row({ appId: 2, appName: "Flat", country: "US", rank: 55, date: "2026-04-14" }),
      row({ appId: 3, appName: "Down", country: "US", rank: 10, date: "2026-04-07" }),
      row({ appId: 3, appName: "Down", country: "US", rank: 60, date: "2026-04-14" }),
    ];
    const result = detectRisingGames(rows, cfg, REFERENCE);
    expect(result).toHaveLength(0);
  });

  it("flags a brand-new entry when includeNewEntries is true", () => {
    const rows: ChartSnapshotRow[] = [
      row({ appId: 4, appName: "Debut", country: "US", rank: 30, date: "2026-04-14" }),
      // app 5 existed before but stayed, should not count
      row({ appId: 5, appName: "Old", country: "US", rank: 100, date: "2026-04-07" }),
      row({ appId: 5, appName: "Old", country: "US", rank: 102, date: "2026-04-14" }),
    ];
    const result = detectRisingGames(rows, cfg, REFERENCE);
    expect(result).toHaveLength(1);
    expect(result[0].appId).toBe(4);
    expect(result[0].isNewEntry).toBe(true);
    expect(result[0].oldRank).toBeNull();
  });

  it("aggregates multi-country momentum", () => {
    const rows: ChartSnapshotRow[] = [
      row({ appId: 6, appName: "Global", country: "US", rank: 150, date: "2026-04-07" }),
      row({ appId: 6, appName: "Global", country: "US", rank: 10, date: "2026-04-14" }),
      row({ appId: 6, appName: "Global", country: "GB", rank: 180, date: "2026-04-07" }),
      row({ appId: 6, appName: "Global", country: "GB", rank: 12, date: "2026-04-14" }),
      row({ appId: 7, appName: "Solo", country: "US", rank: 200, date: "2026-04-07" }),
      row({ appId: 7, appName: "Solo", country: "US", rank: 50, date: "2026-04-14" }),
    ];
    const result = detectRisingGames(rows, cfg, REFERENCE);
    // Global should win because it's rising in 2 countries.
    expect(result[0].appId).toBe(6);
    expect(result[0].countriesRising).toBe(2);
    expect(result[0].momentum).toBeGreaterThan(result[1].momentum);
  });

  it("respects minJump threshold", () => {
    const rows: ChartSnapshotRow[] = [
      row({ appId: 8, appName: "Tiny", country: "US", rank: 40, date: "2026-04-07" }),
      row({ appId: 8, appName: "Tiny", country: "US", rank: 30, date: "2026-04-14" }),
    ];
    const result = detectRisingGames(rows, cfg, REFERENCE);
    expect(result).toHaveLength(0); // delta 10 < minJump 20
  });

  it("tolerates sparse history by picking nearest earlier snapshot", () => {
    const rows: ChartSnapshotRow[] = [
      row({ appId: 9, appName: "Sparse", country: "US", rank: 250, date: "2026-04-05" }),
      row({ appId: 9, appName: "Sparse", country: "US", rank: 20, date: "2026-04-14" }),
    ];
    const result = detectRisingGames(rows, cfg, REFERENCE);
    expect(result).toHaveLength(1);
    expect(result[0].oldRank).toBe(250);
  });

  it("does not return new entries when includeNewEntries is false", () => {
    const rows: ChartSnapshotRow[] = [
      row({ appId: 10, appName: "Debut", country: "US", rank: 30, date: "2026-04-14" }),
    ];
    const result = detectRisingGames(
      rows,
      { ...cfg, includeNewEntries: false },
      REFERENCE
    );
    expect(result).toHaveLength(0);
  });
});
