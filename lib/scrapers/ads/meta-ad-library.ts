import { BaseScraper, ScraperConfig, ScraperResult } from "@/lib/scrapers/base-scraper";
import { apps, adCreatives } from "@/lib/db/schema";
import { eq, and, or } from "drizzle-orm";
import { getApiKey } from "@/lib/api-keys";
import { variantGroupIdFor } from "@/lib/ads/variant-grouping";
import { fetchWithMetaBackoff } from "@/lib/scrapers/ads/meta-rate-limit";

// ── Types ──────────────────────────────────────────────────────────────

export interface MetaAdEntry {
  storeId: string;
  platform: "meta";
  creativeType: string;
  creativeUrl: string;
  adCopy: string;
  headline: string;
  cta: string;
  firstSeen: string;
  lastSeen: string | null;
  isActive: boolean;
  countries: string[];
  publisherPlatforms: string[];
  impressionsLower: number | null;
  impressionsUpper: number | null;
  // Page-level identifier we use for app matching when the page name
  // doesn't line up with the Play/App Store record.
  pageName: string;
}

interface RawMetaAdResult {
  adId?: string;
  id?: string;
  pageId?: string;
  page_id?: string;
  pageName?: string;
  page_name?: string;
  adCreativeBody?: string;
  ad_creative_bodies?: string[];
  adCreativeLinkTitle?: string;
  ad_creative_link_titles?: string[];
  adCreativeLinkCaption?: string;
  ad_creative_link_captions?: string[];
  adCreativeImageUrl?: string;
  ad_snapshot_url?: string;
  adStartDate?: string;
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  isActive?: boolean;
  publisher_platforms?: string[];
  // Meta returns country breakdowns either as a string list or objects.
  countries?: string[] | Array<{ country?: string }>;
  impressions?: { lower_bound?: string; upper_bound?: string };
}

// ── Parser ─────────────────────────────────────────────────────────────

function firstString(
  single: string | undefined,
  list: string[] | undefined
): string {
  if (single && single.length > 0) return single;
  if (list && list.length > 0) return list[0];
  return "";
}

function normalizeCountries(
  raw: RawMetaAdResult["countries"]
): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((v) => (typeof v === "string" ? v : v?.country ?? null))
      .filter((v): v is string => Boolean(v))
      .map((v) => v.toUpperCase());
  }
  return [];
}

function detectCreativeType(snapshotUrl: string): string {
  // The snapshot URL itself doesn't expose type, but video ads in the
  // archive API tend to return snapshot URLs containing "video". Fall back
  // to "image" so existing UI filters still work.
  if (snapshotUrl.toLowerCase().includes("video")) return "video";
  return "image";
}

export function parseMetaAdResult(
  raw: RawMetaAdResult,
  storeId: string
): MetaAdEntry {
  const snapshotUrl =
    raw.ad_snapshot_url ?? raw.adCreativeImageUrl ?? "";
  const firstSeen =
    raw.ad_delivery_start_time ?? raw.adStartDate ?? "";
  const lastSeen = raw.ad_delivery_stop_time ?? null;
  const explicitlyInactive =
    typeof raw.isActive === "boolean"
      ? !raw.isActive
      : Boolean(lastSeen);
  const impressionsLower = raw.impressions?.lower_bound
    ? Number(raw.impressions.lower_bound)
    : null;
  const impressionsUpper = raw.impressions?.upper_bound
    ? Number(raw.impressions.upper_bound)
    : null;

  return {
    storeId,
    platform: "meta",
    creativeType: detectCreativeType(snapshotUrl),
    creativeUrl: snapshotUrl,
    adCopy: firstString(raw.adCreativeBody, raw.ad_creative_bodies),
    headline: firstString(raw.adCreativeLinkTitle, raw.ad_creative_link_titles),
    cta: firstString(raw.adCreativeLinkCaption, raw.ad_creative_link_captions),
    firstSeen,
    lastSeen,
    isActive: !explicitlyInactive,
    countries: normalizeCountries(raw.countries),
    publisherPlatforms: Array.isArray(raw.publisher_platforms)
      ? raw.publisher_platforms
      : [],
    impressionsLower: Number.isFinite(impressionsLower) ? impressionsLower : null,
    impressionsUpper: Number.isFinite(impressionsUpper) ? impressionsUpper : null,
    pageName: raw.page_name ?? raw.pageName ?? "",
  };
}

// ── Scraper ────────────────────────────────────────────────────────────

const META_GRAPH_VERSION = "v20.0";
const META_ADS_ARCHIVE_ENDPOINT = `https://graph.facebook.com/${META_GRAPH_VERSION}/ads_archive`;
const DEFAULT_COUNTRIES = ["US", "GB", "DE", "TR", "BR", "JP", "KR"];

export class MetaAdLibraryScraper extends BaseScraper<MetaAdEntry> {
  config: ScraperConfig = {
    name: "meta-ad-library",
    category: "ads",
    rateLimit: { requests: 2, perSeconds: 30 },
    retryCount: 2,
    timeout: 30000,
  };

  async fetch(): Promise<ScraperResult<MetaAdEntry>> {
    const { db } = await import("@/lib/db/client");
    const errors: string[] = [];
    const records: MetaAdEntry[] = [];

    const token = await getApiKey("META_AD_LIBRARY_TOKEN");
    if (!token) {
      return {
        source: this.config.name,
        fetchedAt: new Date(),
        records: [],
        errors: [
          "META_AD_LIBRARY_TOKEN is not configured — add it in Settings or .env to enable live scraping.",
        ],
      };
    }

    // Fetch ads for own games + the watchlist (top grossing / top free auto-sync).
    // Meta Ad Library doesn't expose store-id-to-page mapping, so we match by name.
    const targets = await db
      .select({ id: apps.id, name: apps.name, storeId: apps.storeId })
      .from(apps)
      .where(or(eq(apps.isOwnGame, true), eq(apps.trackAds, true)))
      .limit(500);

    if (targets.length === 0) {
      return {
        source: this.config.name,
        fetchedAt: new Date(),
        records: [],
        errors: [
          "No apps are on the watchlist — run syncWatchlist() or flag at least one app as isOwnGame=true.",
        ],
      };
    }

    // De-dup by normalized name: the same game often exists in both Play and
    // App Store with identical titles. One Meta API call covers both stores.
    const seen = new Set<string>();
    const deduped = targets.filter((t) => {
      const key = t.name.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    for (const game of deduped) {
      try {
        const url = new URL(META_ADS_ARCHIVE_ENDPOINT);
        url.searchParams.set("access_token", token);
        url.searchParams.set("search_terms", game.name);
        url.searchParams.set("ad_type", "ALL");
        url.searchParams.set("ad_active_status", "ALL");
        url.searchParams.set(
          "ad_reached_countries",
          JSON.stringify(DEFAULT_COUNTRIES)
        );
        url.searchParams.set(
          "fields",
          [
            "id",
            "page_id",
            "page_name",
            "ad_creative_bodies",
            "ad_creative_link_titles",
            "ad_creative_link_captions",
            "ad_snapshot_url",
            "ad_delivery_start_time",
            "ad_delivery_stop_time",
            "publisher_platforms",
            "impressions",
            "languages",
          ].join(",")
        );
        url.searchParams.set("limit", "50");

        const resp = await fetchWithMetaBackoff(
          url.toString(),
          { signal: AbortSignal.timeout(this.config.timeout) },
          { maxAttempts: 4 }
        );

        if (!resp.ok) {
          const bodyText = await resp.text().catch(() => "");
          errors.push(
            `[${game.name}] Meta API ${resp.status}: ${bodyText.slice(0, 200)}`
          );
          await this.rateLimit();
          continue;
        }

        const json = (await resp.json()) as {
          data?: RawMetaAdResult[];
          error?: { message?: string };
        };

        if (json.error) {
          errors.push(`[${game.name}] ${json.error.message ?? "Meta API error"}`);
          await this.rateLimit();
          continue;
        }

        for (const raw of json.data ?? []) {
          records.push(parseMetaAdResult(raw, game.storeId));
        }

        await this.rateLimit();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`[${game.name}] ${msg}`);
      }
    }

    return {
      source: this.config.name,
      fetchedAt: new Date(),
      records,
      errors,
    };
  }

  async store(records: MetaAdEntry[]): Promise<void> {
    const { db } = await import("@/lib/db/client");

    for (const entry of records) {
      // Find the app in DB — try both stores since Meta doesn't know which one.
      const matched = await db
        .select()
        .from(apps)
        .where(eq(apps.storeId, entry.storeId))
        .limit(1);

      if (matched.length === 0) {
        continue;
      }

      const appId = matched[0].id;
      const variantGroupId = variantGroupIdFor({
        appId,
        headline: entry.headline,
        adCopy: entry.adCopy,
      });

      // Dedupe on (appId, creativeUrl) — Meta's snapshot URLs are stable per ad.
      const existing = await db
        .select({ id: adCreatives.id, countries: adCreatives.countries })
        .from(adCreatives)
        .where(
          and(
            eq(adCreatives.appId, appId),
            eq(adCreatives.creativeUrl, entry.creativeUrl)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Merge country list — a creative can surface in multiple runs.
        const prev: string[] = existing[0].countries
          ? (JSON.parse(existing[0].countries) as string[])
          : [];
        const merged = Array.from(new Set([...prev, ...entry.countries]));

        await db
          .update(adCreatives)
          .set({
            lastSeen: entry.lastSeen ?? new Date().toISOString().slice(0, 10),
            isActive: entry.isActive,
            countries: JSON.stringify(merged),
            platforms: JSON.stringify(entry.publisherPlatforms),
            impressionsLower: entry.impressionsLower,
            impressionsUpper: entry.impressionsUpper,
            variantGroupId,
          })
          .where(eq(adCreatives.id, existing[0].id));
        continue;
      }

      await db.insert(adCreatives).values({
        appId,
        platform: entry.platform,
        creativeType: entry.creativeType,
        creativeUrl: entry.creativeUrl,
        adCopy: entry.adCopy,
        headline: entry.headline,
        cta: entry.cta,
        firstSeen: entry.firstSeen,
        lastSeen: entry.lastSeen,
        isActive: entry.isActive,
        countries: JSON.stringify(entry.countries),
        platforms: JSON.stringify(entry.publisherPlatforms),
        impressionsLower: entry.impressionsLower,
        impressionsUpper: entry.impressionsUpper,
        variantGroupId,
      });
    }
  }
}
