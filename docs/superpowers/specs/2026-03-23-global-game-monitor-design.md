# GlobalGameMonitor — Design Spec

**Date:** 2026-03-23
**Status:** Approved
**Author:** Caner Tuzun + Claude

## Overview

GlobalGameMonitor is a local-first web dashboard for tracking mobile game market data, competitor performance, and advertising trends. Inspired by [WorldMonitor](https://github.com/koala73/worldmonitor), it aggregates 33+ free data sources into a single monitoring interface focused on the gaming industry.

**Goals:**
- Track App Store / Google Play rankings, ratings, downloads for own games and competitors
- Monitor competitor ad creatives across Meta, Google, TikTok, Unity Ads
- Track SDK/ad network adoption across the market
- ASO keyword tracking and competitor keyword analysis
- Community sentiment from Reddit, Twitch, and industry news
- Start as a personal local tool, scale to a deployable product later

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | Next.js (App Router) | Single project for frontend + backend + API |
| Database | SQLite + Drizzle ORM | Zero setup, file-based, type-safe, easy PostgreSQL migration |
| UI | shadcn/ui + Tailwind CSS | Copy-paste components, no heavy dependencies |
| Charts | Recharts | React-native charting, time series + comparisons |
| Tables | TanStack Table | Sort, filter, paginate out of the box |
| Scraping (static) | Cheerio | Lightweight HTML parsing |
| Scraping (dynamic) | Playwright | Headless browser for JS-rendered pages |
| Language | TypeScript | End-to-end type safety |

## Data Sources (33 Sources)

### A) Game Market Data

| # | Source | Data | Access Method |
|---|--------|------|---------------|
| 1 | Apple RSS Marketing Tools API | iOS Top Free/Paid/Grossing charts (up to 200, by country+category) | JSON API, no auth |
| 2 | iTunes Search/Lookup API | iOS app metadata, rating, review count | JSON API, no auth |
| 3 | google-play-scraper (Node.js) | Google Play detail, ratings, reviews, download range, top charts | npm library |
| 4 | app-store-scraper (Node.js) | iOS detail, search, similar apps, reviews, top charts | npm library |
| 5 | SteamSpy API | Steam player estimates, CCU, playtime, price | JSON API, no auth |
| 6 | Steam Web API | Player counts, news, achievements | API key (free) |
| 7 | AppBrain | Android rankings, ranking history, SDK info | Web scraping |
| 8 | IGDB API (Twitch) | Game metadata — release dates, platforms, genres, ratings | REST API (Twitch OAuth) |

### C) Competitor Analysis

| # | Source | Data | Access Method |
|---|--------|------|---------------|
| 9 | Apple/Google Play Top Charts | Category-based top 100-200 lists | APIs above |
| 10 | ASOTools | 50M keywords, 6M apps, download/revenue estimates | Web scraping |
| 11 | ASOMobile | 16 free ASO tools — keyword volume, density, comparison | Web scraping |
| 12 | Asodesk | Keyword auto-suggest, traffic score, visibility score | Web scraping |
| 13 | GameRefinery | Feature-level analysis, genre benchmarks, 100K+ games | Web scraping (free plan) |
| 14 | Google Trends | Game name search interest, regional comparison | pytrends or web scraping |
| 15 | Similarweb | Traffic estimates, DAU/MAU, session duration | Web scraping |

### F) Ad / UA Data

| # | Source | Data | Access Method |
|---|--------|------|---------------|
| 16 | Meta Ad Library | Facebook/Instagram active ads, creatives, copy, dates | Web scraping + API |
| 17 | Google Ads Transparency Center | Google/YouTube ads by advertiser | Web scraping |
| 18 | TikTok Creative Center | Top performing TikTok ads, gaming filter | Web scraping |
| 19 | BigSpy (free tier) | 9 platforms — Facebook, TikTok, YouTube, Unity Ads, AdMob | Web scraping |
| 20 | AppBrain SDK Stats | Android SDK/ad network usage, market share | Web scraping |
| 21 | MightySignal | SDK intelligence — which app uses which ad SDK | Web scraping (top apps) |

### Community & Trend Sources

| # | Source | Data | Access Method |
|---|--------|------|---------------|
| 22 | Reddit (r/AndroidGaming, r/iosgaming, r/gamedev) | Player sentiment, trending games | Reddit API / RSS |
| 23 | TwitchTracker / Streams Charts | Game viewership stats, popularity | Web scraping |
| 24 | PocketGamer.biz, Mobidictum | Industry news, revenue reports | RSS / Web scraping |
| 25 | Adjust, Liftoff, AppsFlyer, Singular reports | CPI benchmarks, ROAS, UA trends | Free PDF |
| 26 | Google Trends | Search interest over time | pytrends library |
| 27 | Appfigures (free tier) | 5 apps — sales, reviews, keyword rankings | Web + limited API |
| 28 | AppFollow (free tier) | 2 apps — review monitoring, ASO | Web dashboard |
| 29 | Google Play Developer API | Own app reviews/data | REST API (OAuth) |
| 30 | GameAnalytics | In-game analytics + benchmarks | SDK integration |
| 31 | Firebase Analytics | In-game analytics | SDK integration |
| 32 | Twitch API | Current top games by viewers | REST API (Twitch OAuth) |
| 33 | Reddit RSS | Subreddit feeds without API auth | RSS feeds |

## Database Schema (SQLite)

### apps
Tracked games — own games and competitors.

```sql
CREATE TABLE apps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store TEXT NOT NULL,              -- 'appstore' | 'playstore' | 'steam'
  store_id TEXT NOT NULL,           -- store-specific ID
  name TEXT NOT NULL,
  developer TEXT,
  category TEXT,
  icon_url TEXT,
  is_own_game BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(store, store_id)
);
```

### market_snapshots
Time-series market data for each tracked app.

```sql
CREATE TABLE market_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id INTEGER NOT NULL REFERENCES apps(id),
  source TEXT NOT NULL,
  date DATE NOT NULL,
  rank INTEGER,
  category_rank INTEGER,
  rating REAL,
  rating_count INTEGER,
  downloads_estimate TEXT,
  revenue_estimate TEXT,
  price REAL,
  version TEXT,
  raw_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### top_charts
Category chart snapshots.

```sql
CREATE TABLE top_charts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store TEXT NOT NULL,
  country TEXT NOT NULL,
  category TEXT NOT NULL,
  chart_type TEXT NOT NULL,        -- 'free' | 'paid' | 'grossing'
  date DATE NOT NULL,
  rank INTEGER NOT NULL,
  app_id INTEGER REFERENCES apps(id)
);
```

### aso_keywords
ASO keyword tracking.

```sql
CREATE TABLE aso_keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id INTEGER NOT NULL REFERENCES apps(id),
  keyword TEXT NOT NULL,
  search_volume INTEGER,
  difficulty REAL,
  rank_position INTEGER,
  source TEXT NOT NULL,
  date DATE NOT NULL
);
```

### ad_creatives
Competitor ad tracking.

```sql
CREATE TABLE ad_creatives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id INTEGER REFERENCES apps(id),
  platform TEXT NOT NULL,           -- 'meta' | 'google' | 'tiktok' | 'unity' | 'admob'
  creative_type TEXT,               -- 'image' | 'video' | 'playable' | 'carousel'
  creative_url TEXT,
  ad_copy TEXT,
  headline TEXT,
  cta TEXT,
  first_seen DATE,
  last_seen DATE,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### sdk_usage
SDK/ad network adoption tracking.

```sql
CREATE TABLE sdk_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id INTEGER NOT NULL REFERENCES apps(id),
  sdk_name TEXT NOT NULL,
  sdk_category TEXT,                -- 'ads' | 'analytics' | 'attribution' | 'crash' | 'other'
  detected_at DATE NOT NULL,
  removed_at DATE,
  source TEXT NOT NULL
);
```

### community_signals
Reddit, Twitch, news mentions.

```sql
CREATE TABLE community_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id INTEGER REFERENCES apps(id),
  source TEXT NOT NULL,             -- 'reddit' | 'twitch' | 'news'
  title TEXT,
  url TEXT,
  content_summary TEXT,
  sentiment_score REAL,
  engagement_score REAL,
  date DATE NOT NULL
);
```

### scraper_runs
Scraper execution logs.

```sql
CREATE TABLE scraper_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scraper_name TEXT NOT NULL,
  started_at DATETIME NOT NULL,
  finished_at DATETIME,
  status TEXT NOT NULL,             -- 'running' | 'success' | 'error'
  records_fetched INTEGER DEFAULT 0,
  error_message TEXT
);
```

## API Design (Next.js API Routes)

```
app/api/
  ├── scraper/
  │   ├── run/[name]/route.ts      POST — trigger single scraper
  │   ├── run-all/route.ts         POST — trigger all scrapers
  │   └── status/route.ts          GET  — scraper_runs logs
  ├── apps/
  │   ├── route.ts                 GET (list) / POST (add game)
  │   ├── [id]/route.ts            GET (detail) / PUT / DELETE
  │   └── [id]/snapshots/route.ts  GET — market data time series
  ├── charts/
  │   └── route.ts                 GET — top chart data (store, country, category filter)
  ├── ads/
  │   ├── route.ts                 GET — ad list (platform, app filter)
  │   └── [id]/route.ts            GET — ad detail
  ├── aso/
  │   └── route.ts                 GET — keyword data (app_id filter)
  ├── sdk/
  │   └── route.ts                 GET — SDK usage data
  ├── community/
  │   └── route.ts                 GET — community signals
  └── dashboard/
      └── summary/route.ts        GET — dashboard summary (latest from all sources)
```

**API conventions:**
- All list endpoints support pagination: `?page=1&limit=50`
- Date range filter: `?from=2026-01-01&to=2026-03-23`
- Scrapers run async — API returns `{ status: "started", runId: "..." }` immediately
- Scraper completion tracked via `/api/scraper/status`

## Frontend Pages

```
app/
  ├── page.tsx                     Main Dashboard — summary cards, recent changes
  ├── apps/
  │   ├── page.tsx                 Tracked games list
  │   └── [id]/page.tsx            Game detail — all data on one page
  ├── charts/
  │   └── page.tsx                 Top Charts — store/country/category filtered tables
  ├── ads/
  │   └── page.tsx                 Ad Monitor — creative gallery + filters
  ├── aso/
  │   └── page.tsx                 ASO Tracking — keyword rankings, changes
  ├── sdk/
  │   └── page.tsx                 SDK Intelligence — who uses what
  ├── community/
  │   └── page.tsx                 Community Signals — Reddit, Twitch, news
  └── settings/
      └── page.tsx                 Settings — scraper config, add games
```

**Main Dashboard (/) content:**
- Own games ranking change cards (green up / red down arrows)
- Competitor changes in last 24 hours
- Newly detected competitor ads (last 5)
- Community signals (trending mentions)
- Scraper status — last run times, error warnings

## Project Structure

```
GlobalGameMonitor/
  ├── app/                          Next.js App Router pages + API routes
  ├── lib/
  │   ├── db/
  │   │   ├── schema.ts            Drizzle ORM table definitions
  │   │   ├── client.ts            SQLite connection
  │   │   └── migrations/          Database migrations
  │   ├── scrapers/
  │   │   ├── base-scraper.ts      Common interface + retry + rate-limit
  │   │   ├── market/              Market scrapers
  │   │   ├── competitor/          Competitor analysis scrapers
  │   │   ├── ads/                 Ad scrapers
  │   │   └── community/           Community scrapers
  │   └── utils/
  │       ├── date.ts              Date helpers
  │       └── formatting.ts        Number/currency formatting
  ├── components/
  │   ├── ui/                      shadcn/ui components
  │   ├── charts/                  Chart components (Recharts)
  │   ├── tables/                  Table components (TanStack Table)
  │   └── layout/                  Sidebar, Header, Navigation
  ├── public/
  ├── drizzle.config.ts
  ├── next.config.ts
  ├── package.json
  ├── tsconfig.json
  └── .env.local                   API keys (Steam, Twitch etc.)
```

## Scraper Base Class

```typescript
interface ScraperResult<T> {
  source: string;
  fetchedAt: Date;
  records: T[];
  errors: string[];
}

interface ScraperConfig {
  name: string;
  category: 'market' | 'competitor' | 'ads' | 'community';
  rateLimit: { requests: number; perSeconds: number };
  retryCount: number;
  timeout: number;
}

abstract class BaseScraper<T> {
  abstract config: ScraperConfig;
  abstract fetch(): Promise<ScraperResult<T>>;
  abstract parse(raw: unknown): T[];
  abstract store(records: T[]): Promise<void>;

  async run(): Promise<void> {
    // 1. Log "started" to scraper_runs
    // 2. Apply rate limiting
    // 3. Call fetch() with retry logic
    // 4. Call parse() to transform raw data
    // 5. Call store() to save to SQLite
    // 6. Log "success/error" to scraper_runs
  }
}
```

## Scraper Modules

```
lib/scrapers/
  ├── base-scraper.ts
  ├── market/
  │   ├── apple-top-charts.ts        Apple RSS Marketing Tools API
  │   ├── apple-app-detail.ts        iTunes Search/Lookup API
  │   ├── google-play-detail.ts      google-play-scraper npm
  │   ├── google-play-top-charts.ts  google-play-scraper npm
  │   ├── steamspy.ts                SteamSpy API
  │   ├── steam-api.ts               Steam Web API
  │   ├── appbrain.ts                AppBrain web scraping
  │   └── igdb.ts                    IGDB/Twitch API
  ├── competitor/
  │   ├── aso-tools.ts               ASOTools scraping
  │   ├── aso-mobile.ts              ASOMobile scraping
  │   ├── asodesk.ts                 Asodesk scraping
  │   ├── game-refinery.ts           GameRefinery scraping
  │   ├── google-trends.ts           Google Trends scraping
  │   └── similarweb.ts             Similarweb scraping
  ├── ads/
  │   ├── meta-ad-library.ts         Meta Ad Library
  │   ├── google-ads-transparency.ts Google Ads Transparency Center
  │   ├── tiktok-creative.ts         TikTok Creative Center
  │   ├── bigspy.ts                  BigSpy scraping
  │   ├── appbrain-sdk.ts            AppBrain SDK intelligence
  │   └── mightysignal.ts            MightySignal SDK intelligence
  └── community/
      ├── reddit.ts                  Reddit API + RSS
      ├── twitch-tracker.ts          TwitchTracker / Streams Charts
      └── news-rss.ts               PocketGamer, Mobidictum RSS
```

## Sprint Plan

### Sprint 1 — Foundation + 4 Sources (MVP)
1. Project scaffold (Next.js + SQLite + Drizzle)
2. Base scraper class
3. Apple RSS Top Charts scraper
4. Google Play scraper (google-play-scraper npm)
5. iTunes Search API scraper (app detail)
6. Meta Ad Library scraper (basic)
7. Game add/list page
8. Basic dashboard — table view with fetched data

### Sprint 2 — Expansion
- SteamSpy + Steam API
- Google Ads Transparency + TikTok Creative Center
- AppBrain SDK intelligence
- Chart components (trend lines)

### Sprint 3 — Deepening
- ASO sources (ASOTools, ASOMobile, Asodesk)
- Reddit + Twitch community data
- Google Trends integration
- News RSS feeds

### Sprint 4 — Maturation
- Remaining scrapers (GameRefinery, BigSpy, MightySignal, Similarweb)
- Automatic periodic updates (cron)
- Comparison and alert features
- Customizable dashboard widgets
