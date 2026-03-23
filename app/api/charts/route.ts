import { type NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { topCharts, apps } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const store = searchParams.get("store") ?? "appstore";
  const country = searchParams.get("country") ?? "US";
  const category = searchParams.get("category") ?? "games";
  const chartType = searchParams.get("chartType") ?? "free";
  const date = searchParams.get("date");
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") ?? "100")));

  const conditions = [
    eq(topCharts.store, store),
    eq(topCharts.country, country),
    eq(topCharts.category, category),
    eq(topCharts.chartType, chartType),
  ];

  if (date) {
    conditions.push(eq(topCharts.date, date));
  }

  const rows = await db
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
    .where(and(...conditions))
    .orderBy(topCharts.rank)
    .limit(limit);

  return Response.json(rows);
}
