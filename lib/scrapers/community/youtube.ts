import {
  BaseScraper,
  ScraperConfig,
  ScraperResult,
} from "@/lib/scrapers/base-scraper";
import { apps, trendSignals } from "@/lib/db/schema";
import { and, eq, like } from "drizzle-orm";
import { SCRAPER_LIMITS } from "@/lib/config";
import { getApiKey } from "@/lib/api-keys";

// ── Types ──────────────────────────────────────────────────────────────

export interface YouTubeSearchItem {
  id: { videoId: string };
  snippet: {
    title: string;
    channelTitle: string;
    publishedAt: string;
    description: string;
    thumbnails: Record<string, { url: string }>;
  };
}

export interface YouTubeVideoStatsItem {
  id: string;
  statistics: {
    viewCount: string;
    likeCount: string;
    commentCount: string;
  };
}

export interface YouTubeSignal {
  source: "youtube";
  signalType: "video_count";
  name: string;
  value: number;
  metadata: string;
  date: string;
}

export interface YouTubeVideoParsedStats {
  videoId: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
}

// ── Parsers ───────────────────────────────────────────────────────────

export function parseYouTubeSearchResult(
  item: YouTubeSearchItem,
  gameName: string
): YouTubeSignal {
  return {
    source: "youtube",
    signalType: "video_count",
    name: gameName,
    value: 1, // each video is a signal
    metadata: JSON.stringify({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      viewCount: null, // filled later from stats call
    }),
    date: item.snippet.publishedAt.split("T")[0],
  };
}

export function parseYouTubeVideoStats(
  item: YouTubeVideoStatsItem
): YouTubeVideoParsedStats {
  return {
    videoId: item.id,
    viewCount: Number(item.statistics.viewCount),
    likeCount: Number(item.statistics.likeCount),
    commentCount: Number(item.statistics.commentCount),
  };
}

// ── Scraper ────────────────────────────────────────────────────────────

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

export class YouTubeScraper extends BaseScraper<YouTubeSignal> {
  config: ScraperConfig = {
    name: "youtube",
    category: "community",
    rateLimit: { requests: 1, perSeconds: 1 },
    retryCount: 2,
    timeout: 10000,
  };

  async fetch(): Promise<ScraperResult<YouTubeSignal>> {
    const errors: string[] = [];
    const apiKey = await getApiKey("YOUTUBE_API_KEY");

    if (!apiKey) {
      return {
        source: this.config.name,
        fetchedAt: new Date(),
        records: [],
        errors: [
          "YOUTUBE_API_KEY not set — skipping YouTube scraper. Get a free key from Google Cloud Console or set it in Settings > API Keys.",
        ],
      };
    }

    const { db } = await import("@/lib/db/client");

    // Get own games + first 5 tracked apps
    const maxApps = SCRAPER_LIMITS.youtube?.maxAppsToSearch ?? 10;
    const maxResults = SCRAPER_LIMITS.youtube?.maxResultsPerSearch ?? 5;

    const ownGames = await db
      .select()
      .from(apps)
      .where(eq(apps.isOwnGame, true));

    const otherApps = await db
      .select()
      .from(apps)
      .where(eq(apps.isOwnGame, false))
      .limit(5);

    const trackedApps = [...ownGames, ...otherApps].slice(0, maxApps);

    if (trackedApps.length === 0) {
      return {
        source: this.config.name,
        fetchedAt: new Date(),
        records: [],
        errors: ["No tracked apps found to search YouTube for."],
      };
    }

    const allSignals: YouTubeSignal[] = [];
    const allVideoIds: string[] = [];
    // Map videoId -> signal index for enrichment
    const videoIdToSignalIndices = new Map<string, number[]>();

    // Step 1: Search for videos about each game
    for (const app of trackedApps) {
      try {
        await this.rateLimit();

        const query = encodeURIComponent(
          `${app.name} mobile game gameplay`
        );
        const searchUrl = `${YOUTUBE_API_BASE}/search?part=snippet&q=${query}&type=video&order=date&maxResults=${maxResults}&key=${apiKey}`;

        const response = await fetch(searchUrl, {
          signal: AbortSignal.timeout(this.config.timeout),
          headers: { "User-Agent": "GlobalGameMonitor/1.0" },
        });

        if (!response.ok) {
          errors.push(
            `YouTube search for "${app.name}": HTTP ${response.status}`
          );
          continue;
        }

        const data = await response.json();
        const items: YouTubeSearchItem[] = data.items ?? [];

        for (const item of items) {
          const signal = parseYouTubeSearchResult(item, app.name);
          const idx = allSignals.length;
          allSignals.push(signal);

          const videoId = item.id.videoId;
          allVideoIds.push(videoId);

          if (!videoIdToSignalIndices.has(videoId)) {
            videoIdToSignalIndices.set(videoId, []);
          }
          videoIdToSignalIndices.get(videoId)!.push(idx);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`YouTube search for "${app.name}": ${msg}`);
      }
    }

    // Step 2: Batch fetch video stats (50 IDs per call max)
    if (allVideoIds.length > 0) {
      const batches: string[][] = [];
      for (let i = 0; i < allVideoIds.length; i += 50) {
        batches.push(allVideoIds.slice(i, i + 50));
      }

      for (const batch of batches) {
        try {
          await this.rateLimit();

          const ids = batch.join(",");
          const statsUrl = `${YOUTUBE_API_BASE}/videos?part=statistics,snippet&id=${ids}&key=${apiKey}`;

          const response = await fetch(statsUrl, {
            signal: AbortSignal.timeout(this.config.timeout),
            headers: { "User-Agent": "GlobalGameMonitor/1.0" },
          });

          if (!response.ok) {
            errors.push(`YouTube video stats: HTTP ${response.status}`);
            continue;
          }

          const data = await response.json();
          const items: YouTubeVideoStatsItem[] = data.items ?? [];

          for (const item of items) {
            const stats = parseYouTubeVideoStats(item);
            const indices = videoIdToSignalIndices.get(stats.videoId);
            if (indices) {
              for (const idx of indices) {
                // Enrich signal metadata with view/like/comment counts
                const existing = JSON.parse(allSignals[idx].metadata);
                existing.viewCount = stats.viewCount;
                existing.likeCount = stats.likeCount;
                existing.commentCount = stats.commentCount;
                allSignals[idx].metadata = JSON.stringify(existing);
              }
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`YouTube video stats: ${msg}`);
        }
      }
    }

    return {
      source: this.config.name,
      fetchedAt: new Date(),
      records: allSignals,
      errors,
    };
  }

  async store(records: YouTubeSignal[]): Promise<void> {
    const { db } = await import("@/lib/db/client");

    for (const signal of records) {
      // Extract videoId from metadata for dedup check
      const meta = JSON.parse(signal.metadata);
      const videoId = meta.videoId;

      // Skip if same source + videoId already exists (check metadata JSON)
      const existing = await db
        .select({ id: trendSignals.id })
        .from(trendSignals)
        .where(
          and(
            eq(trendSignals.source, signal.source),
            like(trendSignals.metadata, `%"videoId":"${videoId}"%`)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        continue;
      }

      await db.insert(trendSignals).values({
        source: signal.source,
        signalType: signal.signalType,
        name: signal.name,
        value: signal.value,
        metadata: signal.metadata,
        date: signal.date,
      });
    }
  }
}
