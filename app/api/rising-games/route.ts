import { type NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { topCharts, apps } from "@/lib/db/schema";
import { eq, gte, and } from "drizzle-orm";
import { detectRisingGames } from "@/lib/analytics/rising-games";
import { getChartConfig } from "@/lib/settings/chart-config";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const cfg = await getChartConfig();

  const lookbackDays = Math.max(
    1,
    Math.min(
      60,
      Number(searchParams.get("lookbackDays") ?? cfg.rising.lookbackDays)
    )
  );
  const minJump = Math.max(
    1,
    Number(searchParams.get("minJump") ?? cfg.rising.minJump)
  );
  const topN = Math.max(
    1,
    Math.min(500, Number(searchParams.get("topN") ?? cfg.rising.topN))
  );
  const store = searchParams.get("store"); // optional filter: "playstore" | "appstore"
  const chartType =
    searchParams.get("chartType") ?? cfg.chartTypes[0] ?? "free";
  const includeNewEntries =
    searchParams.get("includeNewEntries") !== "false" &&
    cfg.rising.includeNewEntries;

  // Pull enough history to cover the lookback window. We grab an extra 2-day
  // buffer so sparse snapshots still find a nearest-earlier match.
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - (lookbackDays + 2));
  const sinceStr = since.toISOString().slice(0, 10);

  const conditions = [
    gte(topCharts.date, sinceStr),
    eq(topCharts.chartType, chartType),
    eq(topCharts.category, cfg.category),
  ];
  if (store) conditions.push(eq(topCharts.store, store));

  const rows = await db
    .select({
      appId: topCharts.appId,
      appName: apps.name,
      iconUrl: apps.iconUrl,
      store: topCharts.store,
      country: topCharts.country,
      chartType: topCharts.chartType,
      rank: topCharts.rank,
      date: topCharts.date,
    })
    .from(topCharts)
    .innerJoin(apps, eq(topCharts.appId, apps.id))
    .where(and(...conditions));

  const risers = detectRisingGames(
    rows,
    { lookbackDays, minJump, topN, includeNewEntries },
    new Date()
  );

  return Response.json({
    generatedAt: new Date().toISOString(),
    config: { lookbackDays, minJump, topN, chartType, store, includeNewEntries },
    count: risers.length,
    risers,
  });
}
