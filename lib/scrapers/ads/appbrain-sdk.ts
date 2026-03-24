import { BaseScraper, ScraperConfig, ScraperResult } from "@/lib/scrapers/base-scraper";
import { apps, sdkUsage } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import * as cheerio from "cheerio";

// ── Types ──────────────────────────────────────────────────────────────

export interface AppBrainSdkEntry {
  storeId: string;
  sdkName: string;
  sdkCategory: "ads" | "analytics" | "attribution" | "crash" | "other";
  detectedAt: string;
}

interface RawAppBrainSdkEntry {
  appId: string;
  sdkName: string;
  sdkCategory: string;
  detectedDate: string;
}

// ── Parser ─────────────────────────────────────────────────────────────

const KNOWN_CATEGORIES = new Set(["ads", "analytics", "attribution", "crash"]);

export function parseAppBrainSdkEntry(
  raw: RawAppBrainSdkEntry
): AppBrainSdkEntry {
  const category = KNOWN_CATEGORIES.has(raw.sdkCategory)
    ? (raw.sdkCategory as "ads" | "analytics" | "attribution" | "crash")
    : "other";

  return {
    storeId: raw.appId,
    sdkName: raw.sdkName,
    sdkCategory: category,
    detectedAt: raw.detectedDate,
  };
}

// ── Category Mapping ──────────────────────────────────────────────────

function classifySdkCategory(
  sectionTitle: string
): "ads" | "analytics" | "attribution" | "crash" | "other" {
  const lower = sectionTitle.toLowerCase();
  if (lower.includes("ad") || lower.includes("monetization")) return "ads";
  if (lower.includes("analytics") || lower.includes("tracking"))
    return "analytics";
  if (lower.includes("attribution")) return "attribution";
  if (lower.includes("crash") || lower.includes("error")) return "crash";
  return "other";
}

// ── Scraper ────────────────────────────────────────────────────────────

export class AppBrainSdkScraper extends BaseScraper<AppBrainSdkEntry> {
  config: ScraperConfig = {
    name: "appbrain-sdk",
    category: "ads",
    rateLimit: { requests: 1, perSeconds: 3 },
    retryCount: 2,
    timeout: 15000,
  };

  async fetch(): Promise<ScraperResult<AppBrainSdkEntry>> {
    const { db } = await import("@/lib/db/client");
    const allEntries: AppBrainSdkEntry[] = [];
    const errors: string[] = [];
    const today = new Date().toISOString().split("T")[0];

    // Get all tracked Play Store apps
    const trackedApps = await db
      .select()
      .from(apps)
      .where(eq(apps.store, "playstore"));

    for (const app of trackedApps) {
      try {
        await this.rateLimit();

        const response = await fetch(
          `https://www.appbrain.com/app/${app.storeId}`,
          {
            signal: AbortSignal.timeout(this.config.timeout),
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
          }
        );

        if (!response.ok) {
          errors.push(
            `Error fetching app ${app.storeId}: HTTP ${response.status}`
          );
          continue;
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Parse the "Libraries" section — AppBrain organizes SDKs under
        // category headings within a libraries/SDKs section on the page.
        $(".lib-cat").each((_i, catEl) => {
          const sectionTitle = $(catEl).find(".lib-cat-title").text().trim();
          const category = classifySdkCategory(sectionTitle);

          $(catEl)
            .find(".lib-name")
            .each((_j, libEl) => {
              const sdkName = $(libEl).text().trim();
              if (sdkName) {
                allEntries.push({
                  storeId: app.storeId,
                  sdkName,
                  sdkCategory: category,
                  detectedAt: today,
                });
              }
            });
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Error fetching app ${app.storeId}: ${msg}`);
      }
    }

    return {
      source: this.config.name,
      fetchedAt: new Date(),
      records: allEntries,
      errors,
    };
  }

  async store(records: AppBrainSdkEntry[]): Promise<void> {
    const { db } = await import("@/lib/db/client");

    for (const entry of records) {
      // Find the app in DB
      const existing = await db
        .select()
        .from(apps)
        .where(
          and(eq(apps.store, "playstore"), eq(apps.storeId, entry.storeId))
        )
        .limit(1);

      if (existing.length === 0) {
        continue;
      }

      const appId = existing[0].id;

      // Check if this SDK is already tracked for this app (and not removed)
      const existingSdk = await db
        .select()
        .from(sdkUsage)
        .where(
          and(
            eq(sdkUsage.appId, appId),
            eq(sdkUsage.sdkName, entry.sdkName),
            isNull(sdkUsage.removedAt)
          )
        )
        .limit(1);

      if (existingSdk.length > 0) {
        // Already tracked — skip
        continue;
      }

      // Insert new SDK detection
      await db.insert(sdkUsage).values({
        appId,
        sdkName: entry.sdkName,
        sdkCategory: entry.sdkCategory,
        detectedAt: entry.detectedAt,
        source: "appbrain",
      });
    }

    // Mark removed SDKs: find SDKs in DB for these apps that were NOT in
    // the current scrape results
    const appStoreIds = [...new Set(records.map((r) => r.storeId))];

    for (const storeId of appStoreIds) {
      const appRow = await db
        .select()
        .from(apps)
        .where(
          and(eq(apps.store, "playstore"), eq(apps.storeId, storeId))
        )
        .limit(1);

      if (appRow.length === 0) continue;

      const appId = appRow[0].id;
      const currentSdkNames = records
        .filter((r) => r.storeId === storeId)
        .map((r) => r.sdkName);

      // Get all active SDKs for this app from appbrain
      const activeSdks = await db
        .select()
        .from(sdkUsage)
        .where(
          and(
            eq(sdkUsage.appId, appId),
            eq(sdkUsage.source, "appbrain"),
            isNull(sdkUsage.removedAt)
          )
        );

      const today = new Date().toISOString().split("T")[0];

      for (const sdk of activeSdks) {
        if (!currentSdkNames.includes(sdk.sdkName)) {
          // SDK was removed — update removedAt
          await db
            .update(sdkUsage)
            .set({ removedAt: today })
            .where(eq(sdkUsage.id, sdk.id));
        }
      }
    }
  }
}
