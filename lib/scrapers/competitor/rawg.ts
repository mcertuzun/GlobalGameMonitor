import {
  BaseScraper,
  ScraperConfig,
  ScraperResult,
} from "@/lib/scrapers/base-scraper";
import { gameMetadata } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

// ── Types ──────────────────────────────────────────────────────────────

export interface RawgRawGame {
  id: number;
  name: string;
  genres: { name: string }[];
  tags: { name: string }[];
  platforms: { platform: { name: string } }[];
  rating: number;
  ratings_count: number;
  released: string | null;
  developers: { name: string }[];
  publishers: { name: string }[];
  description_raw: string;
  background_image: string | null;
  metacritic: number | null;
  playtime: number;
}

export interface RawgGameParsed {
  source: "rawg";
  sourceId: string;
  name: string;
  genres: string;
  tags: string;
  platforms: string;
  rating: number;
  ratingCount: number;
  releaseDate: string | null;
  developer: string | null;
  publisher: string | null;
  description: string;
  imageUrl: string | null;
  metacriticScore: number | null;
  playtime: number;
}

// ── Parser ─────────────────────────────────────────────────────────────

export function parseRawgGame(data: RawgRawGame): RawgGameParsed {
  return {
    source: "rawg",
    sourceId: String(data.id),
    name: data.name,
    genres: data.genres.map((g) => g.name).join(", "),
    tags: data.tags
      .slice(0, 10)
      .map((t) => t.name)
      .join(", "),
    platforms: data.platforms.map((p) => p.platform.name).join(", "),
    rating: data.rating,
    ratingCount: data.ratings_count,
    releaseDate: data.released ?? null,
    developer: data.developers.length > 0 ? data.developers[0].name : null,
    publisher: data.publishers.length > 0 ? data.publishers[0].name : null,
    description: (data.description_raw ?? "").slice(0, 500),
    imageUrl: data.background_image ?? null,
    metacriticScore: data.metacritic ?? null,
    playtime: data.playtime,
  };
}

// ── Scraper ────────────────────────────────────────────────────────────

export class RawgScraper extends BaseScraper<RawgGameParsed> {
  config: ScraperConfig = {
    name: "rawg",
    category: "competitor",
    rateLimit: { requests: 1, perSeconds: 2 },
    retryCount: 2,
    timeout: 10000,
  };

  async fetch(): Promise<ScraperResult<RawgGameParsed>> {
    const allRecords: RawgGameParsed[] = [];
    const errors: string[] = [];

    // Build date range for last 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const dateFrom = thirtyDaysAgo.toISOString().split("T")[0];
    const dateTo = now.toISOString().split("T")[0];

    const endpoints = [
      `https://api.rawg.io/api/games?ordering=-added&page_size=20&dates=${dateFrom},${dateTo}`,
      `https://api.rawg.io/api/games?ordering=-rating&page_size=20&metacritic=80,100`,
    ];

    for (const url of endpoints) {
      try {
        await this.rateLimit();

        const response = await fetch(url, {
          signal: AbortSignal.timeout(this.config.timeout),
          headers: {
            "User-Agent": "GlobalGameMonitor/1.0",
          },
        });

        if (!response.ok) {
          errors.push(`Error fetching RAWG ${url}: HTTP ${response.status}`);
          continue;
        }

        const data = await response.json();
        const results = data.results ?? [];

        for (const game of results) {
          try {
            const parsed = parseRawgGame(game);
            // Deduplicate by sourceId within this fetch
            if (!allRecords.some((r) => r.sourceId === parsed.sourceId)) {
              allRecords.push(parsed);
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            errors.push(`Error parsing RAWG game ${game.id}: ${msg}`);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Error fetching RAWG: ${msg}`);
      }
    }

    return {
      source: this.config.name,
      fetchedAt: new Date(),
      records: allRecords.slice(0, 40),
      errors,
    };
  }

  async store(records: RawgGameParsed[]): Promise<void> {
    const { db } = await import("@/lib/db/client");
    const now = new Date().toISOString();

    for (const record of records) {
      // Check if record exists
      const existing = await db
        .select({ id: gameMetadata.id })
        .from(gameMetadata)
        .where(
          and(
            eq(gameMetadata.source, record.source),
            eq(gameMetadata.sourceId, record.sourceId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Update existing record
        await db
          .update(gameMetadata)
          .set({
            name: record.name,
            genres: record.genres,
            tags: record.tags,
            platforms: record.platforms,
            rating: record.rating,
            ratingCount: record.ratingCount,
            releaseDate: record.releaseDate,
            developer: record.developer,
            publisher: record.publisher,
            description: record.description,
            imageUrl: record.imageUrl,
            metacriticScore: record.metacriticScore,
            playtime: record.playtime,
            updatedAt: now,
          })
          .where(eq(gameMetadata.id, existing[0].id));
      } else {
        // Insert new record
        await db.insert(gameMetadata).values({
          source: record.source,
          sourceId: record.sourceId,
          name: record.name,
          genres: record.genres,
          tags: record.tags,
          platforms: record.platforms,
          rating: record.rating,
          ratingCount: record.ratingCount,
          releaseDate: record.releaseDate,
          developer: record.developer,
          publisher: record.publisher,
          description: record.description,
          imageUrl: record.imageUrl,
          metacriticScore: record.metacriticScore,
          playtime: record.playtime,
        });
      }
    }
  }
}
