import { db, sqlite } from "@/lib/db/client";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

export async function cleanupOldData(retentionDays: number = 30) {
  const snapshotCutoff = new Date();
  snapshotCutoff.setDate(snapshotCutoff.getDate() - retentionDays);
  const snapshotCutoffStr = snapshotCutoff.toISOString().split("T")[0];

  const signalCutoff = new Date();
  signalCutoff.setDate(signalCutoff.getDate() - Math.floor(retentionDays / 2));
  const signalCutoffStr = signalCutoff.toISOString().split("T")[0];

  const runCutoff = new Date();
  runCutoff.setDate(runCutoff.getDate() - 7);
  const runCutoffStr = runCutoff.toISOString();

  const deletedSnapshots = await db.run(
    sql`DELETE FROM market_snapshots WHERE date < ${snapshotCutoffStr}`
  );

  const deletedCharts = await db.run(
    sql`DELETE FROM top_charts WHERE date < ${snapshotCutoffStr}`
  );

  const deletedSignals = await db.run(
    sql`DELETE FROM community_signals WHERE date < ${signalCutoffStr}`
  );

  const deletedRuns = await db.run(
    sql`DELETE FROM scraper_runs WHERE started_at < ${runCutoffStr}`
  );

  return {
    deletedSnapshots: deletedSnapshots.changes,
    deletedCharts: deletedCharts.changes,
    deletedSignals: deletedSignals.changes,
    deletedRuns: deletedRuns.changes,
  };
}

export async function getDbStats() {
  const [appsCount] = await db.all<{ count: number }>(
    sql`SELECT COUNT(*) as count FROM apps`
  );
  const [snapshotsCount] = await db.all<{ count: number }>(
    sql`SELECT COUNT(*) as count FROM market_snapshots`
  );
  const [chartsCount] = await db.all<{ count: number }>(
    sql`SELECT COUNT(*) as count FROM top_charts`
  );
  const [adsCount] = await db.all<{ count: number }>(
    sql`SELECT COUNT(*) as count FROM ad_creatives`
  );
  const [sdkCount] = await db.all<{ count: number }>(
    sql`SELECT COUNT(*) as count FROM sdk_usage`
  );
  const [signalsCount] = await db.all<{ count: number }>(
    sql`SELECT COUNT(*) as count FROM community_signals`
  );
  const [runsCount] = await db.all<{ count: number }>(
    sql`SELECT COUNT(*) as count FROM scraper_runs`
  );

  let dbSizeMB = 0;
  try {
    const dbPath = path.join(process.cwd(), "data", "ggm.db");
    const stat = fs.statSync(dbPath);
    dbSizeMB = Math.round((stat.size / (1024 * 1024)) * 100) / 100;
  } catch {
    // DB file may not exist yet
  }

  return {
    apps: appsCount.count,
    snapshots: snapshotsCount.count,
    charts: chartsCount.count,
    ads: adsCount.count,
    sdkUsage: sdkCount.count,
    signals: signalsCount.count,
    scraperRuns: runsCount.count,
    dbSizeMB,
  };
}

export async function vacuumDb() {
  sqlite.exec("VACUUM");
}
