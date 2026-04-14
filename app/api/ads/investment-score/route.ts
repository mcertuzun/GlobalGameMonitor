import { type NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { adCreatives, apps } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  computeInvestmentScore,
  countSiblings,
} from "@/lib/ads/investment-score";

interface ScoredCreative {
  id: number;
  appId: number;
  appName: string;
  appIcon: string | null;
  platform: string;
  creativeType: string | null;
  creativeUrl: string | null;
  headline: string | null;
  adCopy: string | null;
  firstSeen: string | null;
  lastSeen: string | null;
  isActive: boolean | null;
  countries: string[];
  platforms: string[];
  impressionsUpper: number | null;
  impressionsLower: number | null;
  daysActive: number;
  countriesCount: number;
  platformsCount: number;
  variantCount: number;
  investmentScore: number;
}

function parseJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const appId = searchParams.get("appId");
  const platform = searchParams.get("platform");
  const limit = Math.min(
    200,
    Math.max(1, Number(searchParams.get("limit") ?? "25"))
  );
  const persist = searchParams.get("persist") === "true";

  const conditions = [];
  if (appId) {
    const id = Number(appId);
    if (!isNaN(id)) conditions.push(eq(adCreatives.appId, id));
  }
  if (platform) conditions.push(eq(adCreatives.platform, platform));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: adCreatives.id,
      appId: adCreatives.appId,
      platform: adCreatives.platform,
      creativeType: adCreatives.creativeType,
      creativeUrl: adCreatives.creativeUrl,
      adCopy: adCreatives.adCopy,
      headline: adCreatives.headline,
      firstSeen: adCreatives.firstSeen,
      lastSeen: adCreatives.lastSeen,
      isActive: adCreatives.isActive,
      countries: adCreatives.countries,
      platforms: adCreatives.platforms,
      variantGroupId: adCreatives.variantGroupId,
      impressionsLower: adCreatives.impressionsLower,
      impressionsUpper: adCreatives.impressionsUpper,
      appName: apps.name,
      appIcon: apps.iconUrl,
    })
    .from(adCreatives)
    .innerJoin(apps, eq(adCreatives.appId, apps.id))
    .where(whereClause)
    .orderBy(desc(adCreatives.firstSeen));

  const siblings = countSiblings(
    rows.map((r) => ({ variantGroupId: r.variantGroupId }))
  );
  const referenceDate = new Date();

  const scored: ScoredCreative[] = rows.map((r) => {
    const countries = parseJsonArray(r.countries);
    const platforms = parseJsonArray(r.platforms);
    const variantSiblings = r.variantGroupId
      ? siblings.get(r.variantGroupId) ?? 1
      : 1;
    const s = computeInvestmentScore({
      firstSeen: r.firstSeen,
      lastSeen: r.lastSeen,
      isActive: r.isActive,
      countries,
      platforms,
      variantSiblings,
      impressionsLower: r.impressionsLower,
      impressionsUpper: r.impressionsUpper,
      referenceDate,
    });

    return {
      id: r.id,
      appId: r.appId,
      appName: r.appName,
      appIcon: r.appIcon,
      platform: r.platform,
      creativeType: r.creativeType,
      creativeUrl: r.creativeUrl,
      headline: r.headline,
      adCopy: r.adCopy,
      firstSeen: r.firstSeen,
      lastSeen: r.lastSeen,
      isActive: r.isActive,
      countries,
      platforms,
      impressionsUpper: r.impressionsUpper,
      impressionsLower: r.impressionsLower,
      daysActive: s.daysActive,
      countriesCount: s.countriesCount,
      platformsCount: s.platformsCount,
      variantCount: s.variantCount,
      investmentScore: Math.round(s.score * 100) / 100,
    };
  });

  scored.sort((a, b) => b.investmentScore - a.investmentScore);

  // Opt-in: cache the computed score back onto the row for cheap reads elsewhere.
  if (persist) {
    for (const row of scored) {
      await db
        .update(adCreatives)
        .set({ investmentScore: row.investmentScore })
        .where(eq(adCreatives.id, row.id));
    }
  }

  const top = scored.slice(0, limit);
  const totalScore = scored.reduce((sum, r) => sum + r.investmentScore, 0) || 1;

  return Response.json({
    total: scored.length,
    top,
    shareOfVoice: top.map((r) => ({
      id: r.id,
      headline: r.headline,
      share: Math.round((r.investmentScore / totalScore) * 10000) / 100,
    })),
    generatedAt: referenceDate.toISOString(),
  });
}
