import { db } from "@/lib/db/client";
import {
  apps,
  marketSnapshots,
  topCharts,
  adCreatives,
  communitySignals,
  scraperRuns,
} from "@/lib/db/schema";
import { eq, desc, count } from "drizzle-orm";

export async function GET() {
  // Total apps count
  const [totalAppsResult] = await db
    .select({ value: count() })
    .from(apps);
  const totalApps = totalAppsResult.value;

  // Own apps count
  const [ownAppsResult] = await db
    .select({ value: count() })
    .from(apps)
    .where(eq(apps.isOwnGame, true));
  const ownApps = ownAppsResult.value;

  // Latest 10 snapshots
  const latestSnapshots = await db
    .select()
    .from(marketSnapshots)
    .orderBy(desc(marketSnapshots.createdAt))
    .limit(10);

  // Latest charts (grouped by store+chartType, latest date)
  const latestCharts = await db
    .select({
      id: topCharts.id,
      store: topCharts.store,
      country: topCharts.country,
      category: topCharts.category,
      chartType: topCharts.chartType,
      date: topCharts.date,
      rank: topCharts.rank,
      appId: topCharts.appId,
      appName: apps.name,
      developer: apps.developer,
      iconUrl: apps.iconUrl,
    })
    .from(topCharts)
    .innerJoin(apps, eq(topCharts.appId, apps.id))
    .orderBy(desc(topCharts.date), topCharts.rank)
    .limit(50);

  // Latest 5 ads
  const latestAds = await db
    .select()
    .from(adCreatives)
    .orderBy(desc(adCreatives.createdAt))
    .limit(5);

  // Community signals count
  const [communityCountResult] = await db
    .select({ value: count() })
    .from(communitySignals);
  const communitySignalCount = communityCountResult.value;

  // Latest 5 community signals
  const latestCommunitySignals = await db
    .select({
      id: communitySignals.id,
      source: communitySignals.source,
      title: communitySignals.title,
      date: communitySignals.date,
      appName: apps.name,
    })
    .from(communitySignals)
    .innerJoin(apps, eq(communitySignals.appId, apps.id))
    .orderBy(desc(communitySignals.date))
    .limit(5);

  // Scraper status (latest 20 runs)
  const scraperStatus = await db
    .select()
    .from(scraperRuns)
    .orderBy(desc(scraperRuns.startedAt))
    .limit(20);

  return Response.json({
    totalApps,
    ownApps,
    latestSnapshots,
    latestCharts,
    latestAds,
    communitySignalCount,
    latestCommunitySignals,
    scraperStatus,
  });
}
