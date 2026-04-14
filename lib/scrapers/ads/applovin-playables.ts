import { BaseScraper, ScraperConfig, ScraperResult } from "@/lib/scrapers/base-scraper";
import { apps, adCreatives } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import * as cheerio from "cheerio";
import { variantGroupIdFor } from "@/lib/ads/variant-grouping";

/**
 * AppLovin publishes a small public showcase of playable and interactive ads at
 * https://www.applovin.com/ad-experiences/ (and similar marketing pages). This
 * scraper pulls that limited sample and best-matches entries to watchlist
 * games by name. Playable URLs are stored as creativeType="playable" with a
 * creativeUrl that can be iframe-embedded.
 *
 * Limitations vs. SensorTower's panel-SDK approach:
 *   - Coverage is tiny (10–200 creatives, hand-curated by AppLovin marketing)
 *   - Impression / spend data unavailable
 *   - No variant history; we only see whatever is live on the page today
 * These limits match reality — playable intelligence at scale requires SDK
 * panels we don't operate.
 */

export interface PlayableEntry {
  matchedAppName: string;
  creativeUrl: string;
  creativeTitle: string;
  thumbnailUrl: string | null;
}

const DEFAULT_SHOWCASE_URL = "https://www.applovin.com/ad-experiences/";

// Parser is a pure function so it can be unit tested without network access.
export function parseAppLovinShowcase(html: string): PlayableEntry[] {
  const $ = cheerio.load(html);
  const entries: PlayableEntry[] = [];

  // AppLovin's showcase uses a common "ad card" pattern: each card has a
  // title (game name), a thumbnail, and either an embedded iframe preview
  // URL or a "Try it" link. We support both card types.
  $(
    '[class*="ad-experience"], [class*="showcase-item"], [class*="ad-card"]'
  ).each((_i, el) => {
    const $el = $(el);
    const title =
      $el.find('[class*="title"], h3, h4').first().text().trim() ||
      $el.attr("data-title") ||
      "";

    const iframeSrc = $el.find("iframe").first().attr("src");
    const linkHref = $el.find("a[href]").first().attr("href");
    const playableUrl = iframeSrc || linkHref || "";

    const thumbnail =
      $el.find("img").first().attr("src") ||
      $el.find("img").first().attr("data-src") ||
      null;

    if (!title || !playableUrl) return;
    // Skip obvious non-playable links (e.g. "Contact us").
    if (/contact|blog|press|about/i.test(playableUrl)) return;

    entries.push({
      matchedAppName: title,
      creativeUrl: playableUrl.startsWith("http")
        ? playableUrl
        : new URL(playableUrl, "https://www.applovin.com").toString(),
      creativeTitle: title,
      thumbnailUrl: thumbnail,
    });
  });

  // De-dupe by (title, url).
  const seen = new Set<string>();
  return entries.filter((e) => {
    const key = `${e.matchedAppName}|${e.creativeUrl}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export class AppLovinPlayablesScraper extends BaseScraper<PlayableEntry> {
  config: ScraperConfig = {
    name: "applovin-playables",
    category: "ads",
    rateLimit: { requests: 1, perSeconds: 5 },
    retryCount: 2,
    timeout: 20000,
  };

  showcaseUrl: string = DEFAULT_SHOWCASE_URL;

  async fetch(): Promise<ScraperResult<PlayableEntry>> {
    const errors: string[] = [];
    try {
      const resp = await fetch(this.showcaseUrl, {
        signal: AbortSignal.timeout(this.config.timeout),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
        },
      });

      if (!resp.ok) {
        return {
          source: this.config.name,
          fetchedAt: new Date(),
          records: [],
          errors: [`AppLovin showcase HTTP ${resp.status}`],
        };
      }

      const html = await resp.text();
      const parsed = parseAppLovinShowcase(html);
      if (parsed.length === 0) {
        errors.push(
          "No playable entries detected — AppLovin may have changed the showcase DOM."
        );
      }

      return {
        source: this.config.name,
        fetchedAt: new Date(),
        records: parsed,
        errors,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        source: this.config.name,
        fetchedAt: new Date(),
        records: [],
        errors: [msg],
      };
    }
  }

  async store(records: PlayableEntry[]): Promise<void> {
    const { db } = await import("@/lib/db/client");
    if (records.length === 0) return;

    const watchlist = await db
      .select({ id: apps.id, name: apps.name })
      .from(apps)
      .where(eq(apps.trackAds, true));

    // Build name index for best-effort matching.
    const byName = new Map<string, number>();
    for (const a of watchlist) byName.set(normalizeName(a.name), a.id);

    const today = new Date().toISOString().slice(0, 10);

    for (const entry of records) {
      const key = normalizeName(entry.matchedAppName);
      // Try exact match first, then "contains" in either direction.
      let appId = byName.get(key);
      if (!appId) {
        for (const [name, id] of byName) {
          if (name.includes(key) || key.includes(name)) {
            appId = id;
            break;
          }
        }
      }
      if (!appId) continue; // non-watchlist game — skip silently

      const variantGroupId = variantGroupIdFor({
        appId,
        headline: entry.creativeTitle,
        adCopy: null,
      });

      const existing = await db
        .select({ id: adCreatives.id })
        .from(adCreatives)
        .where(
          and(
            eq(adCreatives.appId, appId),
            eq(adCreatives.creativeUrl, entry.creativeUrl)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(adCreatives)
          .set({ lastSeen: today, isActive: true })
          .where(eq(adCreatives.id, existing[0].id));
        continue;
      }

      await db.insert(adCreatives).values({
        appId,
        platform: "applovin",
        creativeType: "playable",
        creativeUrl: entry.creativeUrl,
        headline: entry.creativeTitle,
        adCopy: null,
        cta: "play",
        firstSeen: today,
        lastSeen: today,
        isActive: true,
        countries: JSON.stringify([]),
        platforms: JSON.stringify(["applovin"]),
        variantGroupId,
      });
    }
  }
}
