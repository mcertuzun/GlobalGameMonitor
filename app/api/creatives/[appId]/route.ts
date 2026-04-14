import { type NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { adCreatives, apps } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
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

const NEW_BADGE_DAYS = 7;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  const { appId: appIdRaw } = await params;
  const appId = Number(appIdRaw);
  if (!Number.isFinite(appId)) {
    return Response.json({ error: "Invalid appId" }, { status: 400 });
  }

  const searchParams = request.nextUrl.searchParams;
  const onlyActive = searchParams.get("active") === "true";
  const creativeType = searchParams.get("creativeType");
  const country = searchParams.get("country")?.toUpperCase();

  const appRow = await db
    .select()
    .from(apps)
    .where(eq(apps.id, appId))
    .limit(1);

  if (appRow.length === 0) {
    return Response.json({ error: "App not found" }, { status: 404 });
  }

  const conditions = [eq(adCreatives.appId, appId)];
  if (onlyActive) conditions.push(eq(adCreatives.isActive, true));
  if (creativeType) conditions.push(eq(adCreatives.creativeType, creativeType));

  const creatives = await db
    .select()
    .from(adCreatives)
    .where(and(...conditions))
    .orderBy(desc(adCreatives.firstSeen));

  const siblings = countSiblings(
    creatives.map((c) => ({ variantGroupId: c.variantGroupId }))
  );
  const referenceDate = new Date();
  const newBadgeCutoff = new Date(referenceDate);
  newBadgeCutoff.setUTCDate(newBadgeCutoff.getUTCDate() - NEW_BADGE_DAYS);

  const scored = creatives
    .map((c) => {
      const countries = parseJsonArray(c.countries);
      if (country && !countries.includes(country)) return null;
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
      const firstSeenDate = c.firstSeen ? new Date(c.firstSeen) : null;
      const isNew =
        firstSeenDate !== null && firstSeenDate >= newBadgeCutoff;

      return {
        id: c.id,
        platform: c.platform,
        creativeType: c.creativeType,
        creativeUrl: c.creativeUrl,
        headline: c.headline,
        adCopy: c.adCopy,
        cta: c.cta,
        firstSeen: c.firstSeen,
        lastSeen: c.lastSeen,
        isActive: c.isActive,
        isNew,
        countries,
        platforms,
        variantGroupId: c.variantGroupId,
        variantSiblings,
        impressionsLower: c.impressionsLower,
        impressionsUpper: c.impressionsUpper,
        daysActive: s.daysActive,
        countriesCount: s.countriesCount,
        platformsCount: s.platformsCount,
        variantCount: s.variantCount,
        investmentScore: Math.round(s.score * 100) / 100,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  scored.sort((a, b) => b.investmentScore - a.investmentScore);

  const totalScore = scored.reduce((sum, r) => sum + r.investmentScore, 0) || 1;
  const withShare = scored.map((r) => ({
    ...r,
    shareOfVoice: Math.round((r.investmentScore / totalScore) * 10000) / 100,
  }));

  // Aggregate country coverage across all creatives for the header.
  const allCountries = new Set<string>();
  for (const c of scored) for (const cc of c.countries) allCountries.add(cc);

  return Response.json({
    app: appRow[0],
    generatedAt: referenceDate.toISOString(),
    count: withShare.length,
    countries: Array.from(allCountries).sort(),
    creatives: withShare,
  });
}
