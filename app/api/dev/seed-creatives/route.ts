import { type NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { apps, adCreatives, topCharts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { variantGroupIdFor } from "@/lib/ads/variant-grouping";

/**
 * Dev-only seed endpoint — inserts a small realistic set of apps + creatives
 * so the Creative Gallery has something to render without waiting for a real
 * Meta Ad Library token to clear identity verification.
 *
 * Guarded two ways:
 *   1. NODE_ENV must not be "production"
 *   2. ?confirm=true query string required — prevents accidental hits
 *
 * Safe to run multiple times: all inserts dedupe on (store, storeId) or
 * (appId, creativeUrl).
 */

interface SeedApp {
  name: string;
  store: "playstore" | "appstore";
  storeId: string;
  developer: string;
  category: string;
  iconUrl: string;
  reason: "top-grossing" | "top-free" | "own-game";
  topChartRank: number;
  chartType: "free" | "grossing";
}

const SEED_APPS: SeedApp[] = [
  {
    name: "Coin Master",
    store: "playstore",
    storeId: "com.moonactive.coinmaster",
    developer: "Moon Active",
    category: "Casino",
    iconUrl: "https://play-lh.googleusercontent.com/placeholder-coinmaster",
    reason: "top-grossing",
    topChartRank: 3,
    chartType: "grossing",
  },
  {
    name: "Royal Match",
    store: "playstore",
    storeId: "com.dreamgames.royalmatch",
    developer: "Dream Games",
    category: "Puzzle",
    iconUrl: "https://play-lh.googleusercontent.com/placeholder-royal",
    reason: "top-grossing",
    topChartRank: 1,
    chartType: "grossing",
  },
  {
    name: "Monopoly GO",
    store: "playstore",
    storeId: "com.scopely.monopolygo",
    developer: "Scopely",
    category: "Board",
    iconUrl: "https://play-lh.googleusercontent.com/placeholder-monopoly",
    reason: "top-grossing",
    topChartRank: 2,
    chartType: "grossing",
  },
  {
    name: "Last War: Survival",
    store: "playstore",
    storeId: "com.fstudio.lastwar.gp",
    developer: "FirstFun",
    category: "Strategy",
    iconUrl: "https://play-lh.googleusercontent.com/placeholder-lastwar",
    reason: "top-grossing",
    topChartRank: 5,
    chartType: "grossing",
  },
  {
    name: "Block Blast!",
    store: "playstore",
    storeId: "com.block.juggle",
    developer: "Hungry Studio",
    category: "Puzzle",
    iconUrl: "https://play-lh.googleusercontent.com/placeholder-blockblast",
    reason: "top-free",
    topChartRank: 2,
    chartType: "free",
  },
  {
    name: "Subway Surfers",
    store: "playstore",
    storeId: "com.kiloo.subwaysurf",
    developer: "SYBO Games",
    category: "Arcade",
    iconUrl: "https://play-lh.googleusercontent.com/placeholder-subway",
    reason: "top-free",
    topChartRank: 8,
    chartType: "free",
  },
];

interface SeedCreative {
  appStoreId: string;
  headline: string;
  adCopy: string;
  creativeType: "video" | "image" | "playable";
  daysOld: number;
  daysStopped?: number;
  countries: string[];
  impressionsLower: number | null;
  impressionsUpper: number | null;
  platforms: string[];
}

const SEED_CREATIVES: SeedCreative[] = [
  // Coin Master — 3 variants of the same concept
  {
    appStoreId: "com.moonactive.coinmaster",
    headline: "Spin to win massive rewards",
    adCopy: "Build your village and raid friends — millions love it!",
    creativeType: "video",
    daysOld: 94,
    countries: ["US", "GB", "DE", "TR", "BR", "JP", "KR", "FR", "IT", "ES", "NL", "PL"],
    impressionsLower: 1_000_000,
    impressionsUpper: 5_000_000,
    platforms: ["facebook", "instagram", "audience_network"],
  },
  {
    appStoreId: "com.moonactive.coinmaster",
    headline: "Spin to win massive rewards",
    adCopy: "Attack & raid the best mobile game",
    creativeType: "video",
    daysOld: 72,
    countries: ["US", "GB", "DE", "BR"],
    impressionsLower: 500_000,
    impressionsUpper: 1_000_000,
    platforms: ["facebook", "instagram"],
  },
  {
    appStoreId: "com.moonactive.coinmaster",
    headline: "Legendary cards & Viking raids",
    adCopy: "Collect cards, raid villages, build your own!",
    creativeType: "image",
    daysOld: 14,
    countries: ["US", "TR"],
    impressionsLower: null,
    impressionsUpper: null,
    platforms: ["facebook"],
  },

  // Royal Match — heavy puzzle creative cadence
  {
    appStoreId: "com.dreamgames.royalmatch",
    headline: "Help the king restore his castle!",
    adCopy: "Match 3 to save the kingdom — play free!",
    creativeType: "video",
    daysOld: 128,
    countries: ["US", "GB", "DE", "TR", "BR", "JP", "KR", "FR", "IT", "ES", "NL", "PL", "SE"],
    impressionsLower: 5_000_000,
    impressionsUpper: 10_000_000,
    platforms: ["facebook", "instagram", "audience_network"],
  },
  {
    appStoreId: "com.dreamgames.royalmatch",
    headline: "Pull the pin — save the king!",
    adCopy: "Only 2% can solve level 100. Can you?",
    creativeType: "video",
    daysOld: 86,
    countries: ["US", "GB", "TR", "BR", "DE"],
    impressionsLower: 2_000_000,
    impressionsUpper: 5_000_000,
    platforms: ["facebook", "instagram"],
  },
  {
    appStoreId: "com.dreamgames.royalmatch",
    headline: "Royal Match — match 3 puzzle",
    adCopy: "No ads during gameplay. Relax & match.",
    creativeType: "playable",
    daysOld: 40,
    countries: ["US", "GB"],
    impressionsLower: null,
    impressionsUpper: null,
    platforms: ["applovin"],
  },

  // Monopoly GO — recent push
  {
    appStoreId: "com.scopely.monopolygo",
    headline: "Roll, build, win — play Monopoly GO!",
    adCopy: "Join millions in the global Monopoly phenomenon.",
    creativeType: "video",
    daysOld: 65,
    countries: ["US", "GB", "DE", "FR", "IT", "ES", "CA", "AU"],
    impressionsLower: 1_000_000,
    impressionsUpper: 5_000_000,
    platforms: ["facebook", "instagram"],
  },
  {
    appStoreId: "com.scopely.monopolygo",
    headline: "Build your empire in Monopoly GO",
    adCopy: "New event this week — free dice inside!",
    creativeType: "image",
    daysOld: 6,
    countries: ["US", "GB"],
    impressionsLower: null,
    impressionsUpper: null,
    platforms: ["facebook"],
  },

  // Last War — paused old ad
  {
    appStoreId: "com.fstudio.lastwar.gp",
    headline: "Merge soldiers, survive the war",
    adCopy: "4,4,4,4... can you defeat the final boss?",
    creativeType: "video",
    daysOld: 110,
    daysStopped: 20,
    countries: ["US", "GB", "JP", "KR"],
    impressionsLower: null,
    impressionsUpper: null,
    platforms: ["facebook", "instagram"],
  },
  {
    appStoreId: "com.fstudio.lastwar.gp",
    headline: "Merge and fight to survive",
    adCopy: "The #1 trending strategy game.",
    creativeType: "video",
    daysOld: 45,
    countries: ["US", "GB", "DE", "TR", "JP", "KR", "BR"],
    impressionsLower: null,
    impressionsUpper: null,
    platforms: ["facebook", "instagram", "audience_network"],
  },

  // Block Blast — single dominant creative
  {
    appStoreId: "com.block.juggle",
    headline: "Beat the block puzzle!",
    adCopy: "Simple, addictive, completely free.",
    creativeType: "video",
    daysOld: 150,
    countries: ["US", "GB", "DE", "TR", "BR", "JP", "KR", "FR", "IT", "ES"],
    impressionsLower: 2_000_000,
    impressionsUpper: 5_000_000,
    platforms: ["facebook", "instagram", "audience_network"],
  },

  // Subway Surfers — new entry (NEW badge demo)
  {
    appStoreId: "com.kiloo.subwaysurf",
    headline: "New world: Tokyo!",
    adCopy: "Dash through Tokyo in the new Subway Surfers update.",
    creativeType: "video",
    daysOld: 3,
    countries: ["US", "JP", "KR"],
    impressionsLower: null,
    impressionsUpper: null,
    platforms: ["facebook", "instagram"],
  },
];

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return Response.json(
      { error: "Seed endpoint disabled in production" },
      { status: 403 }
    );
  }
  const confirm = request.nextUrl.searchParams.get("confirm");
  if (confirm !== "true") {
    return Response.json(
      {
        error:
          "Add ?confirm=true to run the seed. This will insert demo apps + creatives.",
      },
      { status: 400 }
    );
  }

  let appsInserted = 0;
  let appsUpdated = 0;
  let creativesInserted = 0;
  let creativesSkipped = 0;
  let chartRowsInserted = 0;
  const today = new Date().toISOString().slice(0, 10);

  for (const seedApp of SEED_APPS) {
    const existing = await db
      .select({ id: apps.id })
      .from(apps)
      .where(and(eq(apps.store, seedApp.store), eq(apps.storeId, seedApp.storeId)))
      .limit(1);

    let appId: number;
    if (existing.length > 0) {
      appId = existing[0].id;
      await db
        .update(apps)
        .set({
          name: seedApp.name,
          developer: seedApp.developer,
          category: seedApp.category,
          iconUrl: seedApp.iconUrl,
          trackAds: true,
          watchlistReason: seedApp.reason,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(apps.id, appId));
      appsUpdated += 1;
    } else {
      const [row] = await db
        .insert(apps)
        .values({
          store: seedApp.store,
          storeId: seedApp.storeId,
          name: seedApp.name,
          developer: seedApp.developer,
          category: seedApp.category,
          iconUrl: seedApp.iconUrl,
          trackAds: true,
          watchlistReason: seedApp.reason,
        })
        .returning({ id: apps.id });
      appId = row.id;
      appsInserted += 1;
    }

    // Seed a top-chart entry so the Rising Games view has something too.
    try {
      await db.insert(topCharts).values({
        store: seedApp.store,
        country: "US",
        category: "games",
        chartType: seedApp.chartType,
        date: today,
        rank: seedApp.topChartRank,
        appId,
      });
      chartRowsInserted += 1;
    } catch {
      // unique constraint — already there, skip
    }
  }

  const idByStoreId = new Map<string, number>();
  for (const seedApp of SEED_APPS) {
    const row = await db
      .select({ id: apps.id })
      .from(apps)
      .where(and(eq(apps.store, seedApp.store), eq(apps.storeId, seedApp.storeId)))
      .limit(1);
    if (row.length > 0) idByStoreId.set(seedApp.storeId, row[0].id);
  }

  for (const seed of SEED_CREATIVES) {
    const appId = idByStoreId.get(seed.appStoreId);
    if (!appId) continue;

    const firstSeen = isoDaysAgo(seed.daysOld);
    const lastSeen =
      seed.daysStopped !== undefined ? isoDaysAgo(seed.daysStopped) : null;
    // Deterministic URL so reruns dedupe cleanly.
    const creativeUrl = `https://demo.local/ads/${seed.appStoreId}/${encodeURIComponent(
      seed.headline
    )}`;

    const exists = await db
      .select({ id: adCreatives.id })
      .from(adCreatives)
      .where(
        and(eq(adCreatives.appId, appId), eq(adCreatives.creativeUrl, creativeUrl))
      )
      .limit(1);

    if (exists.length > 0) {
      creativesSkipped += 1;
      continue;
    }

    const variantGroupId = variantGroupIdFor({
      appId,
      headline: seed.headline,
      adCopy: seed.adCopy,
    });

    await db.insert(adCreatives).values({
      appId,
      platform: seed.platforms[0] ?? "meta",
      creativeType: seed.creativeType,
      creativeUrl,
      adCopy: seed.adCopy,
      headline: seed.headline,
      cta: "install",
      firstSeen,
      lastSeen,
      isActive: lastSeen === null,
      countries: JSON.stringify(seed.countries),
      platforms: JSON.stringify(seed.platforms),
      impressionsLower: seed.impressionsLower,
      impressionsUpper: seed.impressionsUpper,
      variantGroupId,
    });
    creativesInserted += 1;
  }

  return Response.json({
    ok: true,
    seeded: {
      apps: { inserted: appsInserted, updated: appsUpdated },
      creatives: { inserted: creativesInserted, skipped: creativesSkipped },
      chartRows: chartRowsInserted,
    },
    next: [
      "GET /creatives — see the gallery",
      "GET /creatives/<appId> — see per-app detail",
      "POST /api/dev/seed-creatives?confirm=true — idempotent, safe to rerun",
    ],
  });
}

export async function GET() {
  return Response.json({
    hint: "Use POST with ?confirm=true to seed demo data.",
    willInsert: {
      apps: SEED_APPS.length,
      creatives: SEED_CREATIVES.length,
    },
  });
}
