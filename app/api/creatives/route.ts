import { type NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { adCreatives, apps } from "@/lib/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import {
  computeInvestmentScore,
  countSiblings,
} from "@/lib/ads/investment-score";

function parseJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Global creative gallery. Returns watchlist apps and their top creatives by
 * investment score, grouped per-app so the UI can render a SensorTower-style
 * gallery with one card per app + expandable top variants.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const reason = searchParams.get("reason"); // "top-grossing" | "top-free" | "own-game" | "manual"
  const onlyActive = searchParams.get("active") === "true";
  const creativeType = searchParams.get("creativeType"); // "video" | "image" | "playable"
  const perAppLimit = Math.max(
    1,
    Math.min(10, Number(searchParams.get("perApp") ?? "3"))
  );
  const appLimit = Math.max(
    1,
    Math.min(300, Number(searchParams.get("limit") ?? "50"))
  );

  const appConditions = [eq(apps.trackAds, true)];
  if (reason) appConditions.push(eq(apps.watchlistReason, reason));

  const watchlist = await db
    .select({
      id: apps.id,
      name: apps.name,
      store: apps.store,
      storeId: apps.storeId,
      iconUrl: apps.iconUrl,
      developer: apps.developer,
      category: apps.category,
      watchlistReason: apps.watchlistReason,
    })
    .from(apps)
    .where(and(...appConditions))
    .limit(appLimit);

  if (watchlist.length === 0) {
    return Response.json({
      generatedAt: new Date().toISOString(),
      count: 0,
      apps: [],
    });
  }

  const appIds = watchlist.map((a) => a.id);
  const creativeConditions = [inArray(adCreatives.appId, appIds)];
  if (onlyActive) creativeConditions.push(eq(adCreatives.isActive, true));
  if (creativeType)
    creativeConditions.push(eq(adCreatives.creativeType, creativeType));

  const creatives = await db
    .select()
    .from(adCreatives)
    .where(and(...creativeConditions))
    .orderBy(desc(adCreatives.firstSeen));

  const siblings = countSiblings(
    creatives.map((c) => ({ variantGroupId: c.variantGroupId }))
  );
  const referenceDate = new Date();

  const byApp = new Map<number, typeof creatives>();
  for (const c of creatives) {
    if (!byApp.has(c.appId)) byApp.set(c.appId, []);
    byApp.get(c.appId)!.push(c);
  }

  const result = watchlist.map((app) => {
    const appCreatives = byApp.get(app.id) ?? [];
    const scored = appCreatives.map((c) => {
      const countries = parseJsonArray(c.countries);
      const platforms = parseJsonArray(c.platforms);
      const variantSiblings = c.variantGroupId
        ? siblings.get(c.variantGroupId) ?? 1
        : 1;
      const s = computeInvestmentScore({
        firstSeen: c.firstSeen,
        lastSeen: c.lastSeen,
        isActive: c.isActive,
        countries,
        platforms,
        variantSiblings,
        impressionsLower: c.impressionsLower,
        impressionsUpper: c.impressionsUpper,
        referenceDate,
      });
      return {
        id: c.id,
        platform: c.platform,
        creativeType: c.creativeType,
        creativeUrl: c.creativeUrl,
        headline: c.headline,
        adCopy: c.adCopy,
        firstSeen: c.firstSeen,
        lastSeen: c.lastSeen,
        isActive: c.isActive,
        countries,
        platforms,
        impressionsLower: c.impressionsLower,
        impressionsUpper: c.impressionsUpper,
        variantGroupId: c.variantGroupId,
        variantSiblings,
        daysActive: s.daysActive,
        investmentScore: Math.round(s.score * 100) / 100,
      };
    });
    scored.sort((a, b) => b.investmentScore - a.investmentScore);

    const totalScore = scored.reduce((sum, s) => sum + s.investmentScore, 0);
    return {
      app,
      creativeCount: scored.length,
      totalInvestmentScore: Math.round(totalScore * 100) / 100,
      topCreatives: scored.slice(0, perAppLimit),
    };
  });

  result.sort(
    (a, b) => b.totalInvestmentScore - a.totalInvestmentScore
  );

  return Response.json({
    generatedAt: referenceDate.toISOString(),
    count: result.length,
    apps: result,
  });
}
