import { db } from "@/lib/db/client";
import { trendSignals, trendsData, apps } from "@/lib/db/schema";
import { eq, desc, count, sql } from "drizzle-orm";

interface NormalizedSignal {
  source: string;
  name: string;
  signalType: string;
  value: number;
  date: string;
}

export async function GET() {
  // Count by source categories
  const [jamSignals] = await db
    .select({ count: count() })
    .from(trendSignals)
    .where(eq(trendSignals.source, "itchio-jams"));

  const [googleTrends] = await db
    .select({ count: count() })
    .from(trendsData);

  const [steamTrends] = await db
    .select({ count: count() })
    .from(trendSignals)
    .where(eq(trendSignals.source, "trending-now"));

  const [youtubeSignals] = await db
    .select({ count: count() })
    .from(trendSignals)
    .where(eq(trendSignals.source, "youtube"));

  // Fetch latest 50 from trendSignals
  const latestTrendSignals = await db
    .select()
    .from(trendSignals)
    .orderBy(desc(trendSignals.date))
    .limit(50);

  // Fetch latest 50 from trendsData (joined with apps for name)
  const latestTrendsData = await db
    .select({
      id: trendsData.id,
      keyword: trendsData.keyword,
      region: trendsData.region,
      interestScore: trendsData.interestScore,
      date: trendsData.date,
      appName: apps.name,
    })
    .from(trendsData)
    .innerJoin(apps, eq(trendsData.appId, apps.id))
    .orderBy(desc(trendsData.date))
    .limit(50);

  // Normalize trendSignals
  const normalizedTrendSignals: NormalizedSignal[] = latestTrendSignals.map((s) => ({
    source: s.source,
    name: s.name,
    signalType: s.signalType,
    value: s.value ?? 0,
    date: s.date,
  }));

  // Normalize trendsData
  const normalizedTrendsData: NormalizedSignal[] = latestTrendsData.map((t) => ({
    source: "google-trends",
    name: `${t.appName} - ${t.keyword}`,
    signalType: "interest_score",
    value: t.interestScore ?? 0,
    date: t.date,
  }));

  // Merge + sort by date desc + limit 50
  const recentSignals = [...normalizedTrendSignals, ...normalizedTrendsData]
    .sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))
    .slice(0, 50);

  return Response.json({
    jamSignals: jamSignals.count,
    googleTrends: googleTrends.count,
    steamTrends: steamTrends.count,
    youtubeSignals: youtubeSignals.count,
    recentSignals,
  });
}
