import {
  sqliteTable,
  text,
  integer,
  real,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ── apps ────────────────────────────────────────────────────────────────
export const apps = sqliteTable(
  "apps",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    store: text("store").notNull(), // "playstore" | "appstore"
    storeId: text("store_id").notNull(), // e.g. "com.example.game" or Apple numeric ID
    name: text("name").notNull(),
    developer: text("developer"),
    category: text("category"),
    iconUrl: text("icon_url"),
    isOwnGame: integer("is_own_game", { mode: "boolean" }).default(false),
    createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [
    uniqueIndex("apps_store_store_id_unique").on(table.store, table.storeId),
  ]
);

// ── market_snapshots ────────────────────────────────────────────────────
export const marketSnapshots = sqliteTable(
  "market_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    appId: integer("app_id")
      .notNull()
      .references(() => apps.id),
    source: text("source").notNull(), // e.g. "google-play-scraper", "app-figures"
    date: text("date").notNull(), // YYYY-MM-DD
    rank: integer("rank"),
    categoryRank: integer("category_rank"),
    rating: real("rating"),
    ratingCount: integer("rating_count"),
    downloadsEstimate: integer("downloads_estimate"),
    revenueEstimate: integer("revenue_estimate"),
    price: real("price"),
    version: text("version"),
    rawJson: text("raw_json"),
    createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [
    index("market_snapshots_app_date_idx").on(table.appId, table.date),
    index("market_snapshots_source_date_idx").on(table.source, table.date),
  ]
);

// ── top_charts ──────────────────────────────────────────────────────────
export const topCharts = sqliteTable(
  "top_charts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    store: text("store").notNull(),
    country: text("country").notNull(),
    category: text("category").notNull(),
    chartType: text("chart_type").notNull(), // "free" | "paid" | "grossing"
    date: text("date").notNull(), // YYYY-MM-DD
    rank: integer("rank").notNull(),
    appId: integer("app_id")
      .notNull()
      .references(() => apps.id),
  },
  (table) => [
    uniqueIndex("top_charts_unique").on(
      table.store,
      table.country,
      table.category,
      table.chartType,
      table.date,
      table.rank
    ),
    index("top_charts_store_country_category_date_idx").on(
      table.store,
      table.country,
      table.category,
      table.date
    ),
  ]
);

// ── aso_keywords ────────────────────────────────────────────────────────
export const asoKeywords = sqliteTable(
  "aso_keywords",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    appId: integer("app_id")
      .notNull()
      .references(() => apps.id),
    keyword: text("keyword").notNull(),
    searchVolume: integer("search_volume"),
    difficulty: real("difficulty"),
    rankPosition: integer("rank_position"),
    source: text("source"),
    date: text("date").notNull(),
  },
  (table) => [
    index("aso_keywords_app_date_idx").on(table.appId, table.date),
  ]
);

// ── ad_creatives ────────────────────────────────────────────────────────
export const adCreatives = sqliteTable(
  "ad_creatives",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    appId: integer("app_id")
      .notNull()
      .references(() => apps.id),
    platform: text("platform").notNull(), // "meta" | "unity" | "applovin" etc.
    creativeType: text("creative_type"), // "image" | "video" | "playable"
    creativeUrl: text("creative_url"),
    adCopy: text("ad_copy"),
    headline: text("headline"),
    cta: text("cta"),
    firstSeen: text("first_seen"),
    lastSeen: text("last_seen"),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [
    index("ad_creatives_app_platform_idx").on(table.appId, table.platform),
  ]
);

// ── sdk_usage ───────────────────────────────────────────────────────────
export const sdkUsage = sqliteTable(
  "sdk_usage",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    appId: integer("app_id")
      .notNull()
      .references(() => apps.id),
    sdkName: text("sdk_name").notNull(),
    sdkCategory: text("sdk_category"), // "analytics" | "ad-network" | "attribution" etc.
    detectedAt: text("detected_at"),
    removedAt: text("removed_at"),
    source: text("source"),
  },
  (table) => [index("sdk_usage_app_idx").on(table.appId)]
);

// ── community_signals ───────────────────────────────────────────────────
export const communitySignals = sqliteTable(
  "community_signals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    appId: integer("app_id").references(() => apps.id),
    source: text("source").notNull(), // "reddit" | "twitter" | "discord" etc.
    title: text("title"),
    url: text("url"),
    contentSummary: text("content_summary"),
    sentimentScore: real("sentiment_score"),
    engagementScore: real("engagement_score"),
    date: text("date").notNull(),
  },
  (table) => [
    index("community_signals_source_date_idx").on(table.source, table.date),
  ]
);

// ── trends_data ─────────────────────────────────────────────────────────
export const trendsData = sqliteTable(
  "trends_data",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    appId: integer("app_id")
      .notNull()
      .references(() => apps.id),
    keyword: text("keyword").notNull(),
    region: text("region"),
    interestScore: real("interest_score"),
    date: text("date").notNull(),
    rawJson: text("raw_json"),
  },
  (table) => [
    index("trends_data_app_date_idx").on(table.appId, table.date),
  ]
);

// ── game_metadata ─────────────────────────────────────────────────────
export const gameMetadata = sqliteTable(
  "game_metadata",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    source: text("source").notNull(), // "rawg" | "igdb" | "itchio"
    sourceId: text("source_id").notNull(), // ID in the source system
    name: text("name").notNull(),
    genres: text("genres"), // comma-separated
    tags: text("tags"), // comma-separated
    platforms: text("platforms"), // comma-separated
    rating: real("rating"),
    ratingCount: integer("rating_count"),
    releaseDate: text("release_date"),
    developer: text("developer"),
    publisher: text("publisher"),
    description: text("description"),
    imageUrl: text("image_url"),
    metacriticScore: integer("metacritic_score"),
    playtime: integer("playtime"), // average in minutes
    rawJson: text("raw_json"),
    createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [
    uniqueIndex("idx_game_metadata_source_id").on(table.source, table.sourceId),
    index("idx_game_metadata_name").on(table.name),
  ]
);

// ── trend_signals ─────────────────────────────────────────────────────
export const trendSignals = sqliteTable(
  "trend_signals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    source: text("source").notNull(), // "trending-now" | "itchio-jams" | "youtube"
    signalType: text("signal_type").notNull(), // "trending" | "jam_theme" | "video_count"
    name: text("name").notNull(), // game name, jam theme, or search term
    value: real("value"), // numeric signal value
    metadata: text("metadata"), // JSON string for extra data
    date: text("date").notNull(),
    createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [
    index("idx_trend_signals_source_date").on(table.source, table.date),
    index("idx_trend_signals_name").on(table.name),
  ]
);

// ── settings ──────────────────────────────────────────────────────────
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// ── scraper_runs ────────────────────────────────────────────────────────
export const scraperRuns = sqliteTable(
  "scraper_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    scraperName: text("scraper_name").notNull(),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at"),
    status: text("status").notNull(), // "running" | "success" | "error"
    recordsFetched: integer("records_fetched"),
    errorMessage: text("error_message"),
  },
  (table) => [
    index("scraper_runs_name_started_idx").on(
      table.scraperName,
      table.startedAt
    ),
  ]
);
