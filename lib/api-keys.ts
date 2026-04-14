import { db } from "@/lib/db/client";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// List of all supported API keys
export const API_KEY_DEFINITIONS = [
  {
    id: "YOUTUBE_API_KEY",
    label: "YouTube Data API",
    description: "Free from Google Cloud Console (10K units/day)",
    url: "https://console.cloud.google.com/apis/credentials",
  },
  {
    id: "STEAM_API_KEY",
    label: "Steam Web API",
    description: "Free from Steam",
    url: "https://steamcommunity.com/dev/apikey",
  },
  {
    id: "TWITCH_CLIENT_ID",
    label: "Twitch Client ID",
    description: "Free from Twitch Developer Console",
    url: "https://dev.twitch.tv/console",
  },
  {
    id: "TWITCH_CLIENT_SECRET",
    label: "Twitch Client Secret",
    description: "For IGDB API + Twitch API",
    url: "https://dev.twitch.tv/console",
  },
  {
    id: "REDDIT_CLIENT_ID",
    label: "Reddit Client ID",
    description: "Free from Reddit Apps",
    url: "https://www.reddit.com/prefs/apps",
  },
  {
    id: "REDDIT_CLIENT_SECRET",
    label: "Reddit Client Secret",
    description: "For Reddit API (optional — RSS works without)",
    url: "https://www.reddit.com/prefs/apps",
  },
  {
    id: "RAWG_API_KEY",
    label: "RAWG API",
    description: "Free from RAWG.io",
    url: "https://rawg.io/apidocs",
  },
  {
    id: "META_AD_LIBRARY_TOKEN",
    label: "Meta Ad Library Token",
    description:
      "Graph API access token (ads_archive scope). Required for creative investment tracking.",
    url: "https://www.facebook.com/ads/library/api/",
  },
];

/**
 * Mask an API key, showing only the last 4 characters.
 * e.g. "AIzaSyB1234567890abcdef" -> "••••cdef"
 */
export function maskApiKey(value: string): string {
  if (value.length <= 4) return "••••";
  return "••••" + value.slice(-4);
}

/**
 * Get API key: check DB settings first, fallback to process.env
 */
export async function getApiKey(keyId: string): Promise<string | null> {
  try {
    const row = await db
      .select()
      .from(settings)
      .where(eq(settings.key, `apikey_${keyId}`))
      .limit(1);

    if (row.length > 0 && row[0].value) {
      return row[0].value;
    }
  } catch {
    // DB error — fall through to env
  }

  return process.env[keyId] || null;
}

/**
 * Save API key to DB settings table
 */
export async function setApiKey(keyId: string, value: string): Promise<void> {
  const dbKey = `apikey_${keyId}`;
  const now = new Date().toISOString();

  const existing = await db
    .select()
    .from(settings)
    .where(eq(settings.key, dbKey))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(settings)
      .set({ value, updatedAt: now })
      .where(eq(settings.key, dbKey));
  } else {
    await db.insert(settings).values({ key: dbKey, value, updatedAt: now });
  }
}

/**
 * Delete API key from DB settings table
 */
export async function deleteApiKey(keyId: string): Promise<void> {
  await db.delete(settings).where(eq(settings.key, `apikey_${keyId}`));
}

/**
 * Get all API keys with their masked values and status
 */
export async function getAllApiKeys(): Promise<
  {
    id: string;
    label: string;
    description: string;
    url: string;
    isSet: boolean;
    maskedValue: string | null;
  }[]
> {
  const results = [];

  for (const def of API_KEY_DEFINITIONS) {
    const value = await getApiKey(def.id);
    results.push({
      id: def.id,
      label: def.label,
      description: def.description,
      url: def.url,
      isSet: value !== null && value.length > 0,
      maskedValue: value ? maskApiKey(value) : null,
    });
  }

  return results;
}
