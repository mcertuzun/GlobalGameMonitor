# GlobalGameMonitor — Design Spec

**Date:** 2026-03-23
**Status:** Approved
**Author:** Caner Tuzun + Claude

## Overview

GlobalGameMonitor is a local-first web dashboard for tracking mobile game market data, competitor performance, and advertising trends. Inspired by [WorldMonitor](https://github.com/koala73/worldmonitor), it aggregates 30+ free data sources into a single monitoring interface focused on the gaming industry.

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
| Database | SQLite (WAL mode) + Drizzle ORM | Zero setup, file-based, type-safe, easy PostgreSQL migration |
| UI | shadcn/ui + Tailwind CSS | Copy-paste components, no heavy dependencies |
| Charts | Recharts | React-native charting, time series + comparisons |
| Tables | TanStack Table | Sort, filter, paginate out of the box |
| Scraping (static) | Cheerio | Lightweight HTML parsing |
| Scraping (dynamic) | Playwright | Headless browser for JS-rendered pages |
| Trends | google-trends-api (npm) | Node.js native Google Trends access, no Python dependency |
| Language | TypeScript | End-to-end type safety |

## Data Sources (30 Sources)

### A) Game Market Data (8 sources)

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

### B) Competitor Analysis (6 sources)

| # | Source | Data | Access Method |
|---|--------|------|---------------|
| 9 | ASOTools | 50M keywords, 6M apps, download/revenue estimates | Web scraping |
| 10 | ASOMobile | 16 free ASO tools — keyword volume, density, comparison | Web scraping |
| 11 | Asodesk | Keyword auto-suggest, traffic score, visibility score | Web scraping |
| 12 | GameRefinery | Feature-level analysis, genre benchmarks, 100K+ games | Web scraping (free plan) |
| 13 | Google Trends | Game name search interest, regional comparison | google-trends-api npm |
| 14 | Similarweb | Traffic estimates, DAU/MAU, session duration | Web scraping |

### C) Ad / UA Data (6 sources)

| # | Source | Data | Access Method |
|---|--------|------|---------------|
| 15 | Meta Ad Library | Facebook/Instagram active ads, creatives, copy, dates | Web scraping + API |
| 16 | Google Ads Transparency Center | Google/YouTube ads by advertiser | Web scraping |
| 17 | TikTok Creative Center | Top performing TikTok ads, gaming filter | Web scraping |
| 18 | BigSpy (free tier) | 9 platforms — Facebook, TikTok, YouTube, Unity Ads, AdMob | Web scraping |
| 19 | AppBrain SDK Stats | Android SDK/ad network usage, market share | Web scraping |
| 20 | MightySignal | SDK intelligence — which app uses which ad SDK | Web scraping (top apps) |

### D) Community & Trend Sources (6 sources)

| # | Source | Data | Access Method |
|---|--------|------|---------------|
| 21 | Reddit (r/AndroidGaming, r/iosgaming, r/gamedev) | Player sentiment, trending games | Reddit API / RSS |
| 22 | TwitchTracker / Streams Charts | Game viewership stats, popularity | Web scraping |
| 23 | Twitch API | Current top games by viewers | REST API (Twitch OAuth) |
| 24 | PocketGamer.biz, Mobidictum | Industry news, revenue reports | RSS / Web scraping |
| 25 | Adjust, Liftoff, AppsFlyer, Singular reports | CPI benchmarks, ROAS, UA trends | Free PDF |
| 26 | Industry news RSS feeds | Market updates, launches, acquisitions | RSS |

### E) Own App Data (4 sources — optional, for own games only)

| # | Source | Data | Access Method |
|---|--------|------|---------------|
| 27 | Google Play Developer API | Own app reviews/data | REST API (OAuth) |
| 28 | Appfigures (free tier, 5 apps) | Sales, reviews, keyword rankings | Web + limited API |
| 29 | AppFollow (free tier, 2 apps) | Review monitoring, ASO | Web dashboard scraping |
| 30 | GameAnalytics / Firebase | In-game analytics + benchmarks | SDK integration (out of scope for scraping) |

> **Note on sources #28-30:** These have strict free tier limits (5 apps, 2 apps respectively). Use them only for own games, not for broad competitor monitoring. Source #30 (GameAnalytics/Firebase) requires SDK integration inside the game itself and is out of scope for the scraper system — listed here for completeness.

## Database Schema (SQLite — WAL Mode)

SQLite is configured in WAL (Write-Ahead Logging) mode to support concurrent reads while a write is in progress. This is critical since Next.js API routes handle requests concurrently.

### apps

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
  downloads_estimate INTEGER,       -- normalized to integer (e.g., 1000000 for "1M+")
  revenue_estimate INTEGER,         -- normalized to cents
  price REAL,
  version TEXT,
  raw_json TEXT,                    -- original API/scrape response for future re-parsing
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_market_snapshots_app_date ON market_snapshots(app_id, date);
CREATE INDEX idx_market_snapshots_source ON market_snapshots(source, date);
```

### top_charts

```sql
CREATE TABLE top_charts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store TEXT NOT NULL,
  country TEXT NOT NULL,
  category TEXT NOT NULL,
  chart_type TEXT NOT NULL,        -- 'free' | 'paid' | 'grossing'
  date DATE NOT NULL,
  rank INTEGER NOT NULL,
  app_id INTEGER REFERENCES apps(id),
  UNIQUE(store, country, category, chart_type, date, rank)
);
CREATE INDEX idx_top_charts_date ON top_charts(store, country, category, date);
```

### aso_keywords

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
CREATE INDEX idx_aso_keywords_app_date ON aso_keywords(app_id, date);
```

### ad_creatives

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
CREATE INDEX idx_ad_creatives_app ON ad_creatives(app_id, platform);
```

### sdk_usage

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
CREATE INDEX idx_sdk_usage_app ON sdk_usage(app_id);
```

### community_signals

```sql
CREATE TABLE community_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id INTEGER REFERENCES apps(id),
  source TEXT NOT NULL,             -- 'reddit' | 'twitch' | 'news'
  title TEXT,
  url TEXT,
  content_summary TEXT,
  sentiment_score REAL,             -- simple keyword-based: -1.0 (negative) to 1.0 (positive)
  engagement_score REAL,
  date DATE NOT NULL
);
CREATE INDEX idx_community_signals_date ON community_signals(source, date);
```

### trends_data

```sql
CREATE TABLE trends_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id INTEGER REFERENCES apps(id),
  keyword TEXT NOT NULL,
  region TEXT DEFAULT 'worldwide',
  interest_score INTEGER,           -- Google Trends 0-100 scale
  date DATE NOT NULL,
  raw_json TEXT
);
CREATE INDEX idx_trends_data_app_date ON trends_data(app_id, date);
```

### scraper_runs

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
CREATE INDEX idx_scraper_runs_name ON scraper_runs(scraper_name, started_at);
```

### Data Retention Policy

- **market_snapshots, top_charts, aso_keywords:** Keep 1 year of daily data. Older data aggregated to weekly averages.
- **ad_creatives:** Keep indefinitely (relatively low volume).
- **community_signals:** Keep 6 months, then delete.
- **trends_data:** Keep 1 year.
- **scraper_runs:** Keep 3 months of logs.
- A scheduled cleanup task runs weekly to enforce retention policies.

## Environment Variables

```env
# Required for Sprint 1 (no keys needed — all free/no-auth sources)
# Nothing required!

# Required for Sprint 2
STEAM_API_KEY=               # Free from https://steamcommunity.com/dev/apikey

# Required for Sprint 3+
TWITCH_CLIENT_ID=            # Free from https://dev.twitch.tv/console
TWITCH_CLIENT_SECRET=        # For IGDB API + Twitch API
REDDIT_CLIENT_ID=            # Free from https://www.reddit.com/prefs/apps
REDDIT_CLIENT_SECRET=        # For Reddit API (optional — RSS works without)

# Optional — for own app data
GOOGLE_PLAY_SERVICE_ACCOUNT= # JSON key for Google Play Developer API
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
  ├── trends/
  │   └── route.ts                 GET — Google Trends data
  └── dashboard/
      └── summary/route.ts        GET — dashboard summary (latest from all sources)
```

**API conventions:**
- All list endpoints support pagination: `?page=1&limit=50`
- Date range filter: `?from=2026-01-01&to=2026-03-23`
- Scraper completion tracked via `/api/scraper/status`

### Async Scraper Execution

Scrapers are long-running and must not block API responses. The mechanism:

1. API route receives POST to `/api/scraper/run/[name]`
2. Creates a `scraper_runs` entry with status `running`
3. Spawns the scraper using `setTimeout(async () => { ... }, 0)` — this detaches from the request lifecycle in Next.js standalone mode
4. Returns immediately: `{ status: "started", runId: "..." }`
5. Frontend polls `/api/scraper/status?runId=...` every 2 seconds to check completion
6. Next.js runs in **standalone mode** (`output: 'standalone'` in next.config.ts) to support long-running background work

For production/deployment: migrate to a proper job queue (BullMQ + Redis) when scaling beyond local use.

## Scraper Resilience

### Error Handling Strategy
- Each scraper wraps its `fetch()` in try/catch — errors are logged to `scraper_runs`, never crash the process
- Retry with exponential backoff: 3 attempts with 1s, 2s, 4s delays
- Per-scraper rate limiting enforced in base class (configurable per source)
- If a scraper fails, dashboard shows last successful data with a "stale" indicator

### Anti-Bot Mitigation
- Cheerio scrapers: random User-Agent rotation, 1-3 second delays between requests
- Playwright scrapers: stealth mode plugin, realistic viewport/timing
- If a source starts blocking consistently, the scraper disables itself and logs a warning — no infinite retries

### Graceful Degradation
- Dashboard always shows whatever data is available
- Each data card shows "Last updated: X hours ago" timestamp
- Scraper status panel on settings page shows green/yellow/red per source
- Yellow = last run >24h ago, Red = last 3 runs failed

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
      └── page.tsx                 Settings — scraper config, add games, scraper health
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
  │   │   ├── client.ts            SQLite connection (WAL mode)
  │   │   └── migrations/          Database migrations
  │   ├── scrapers/
  │   │   ├── base-scraper.ts      Common interface + retry + rate-limit
  │   │   ├── market/              Market scrapers (8 files)
  │   │   ├── competitor/          Competitor analysis scrapers (6 files)
  │   │   ├── ads/                 Ad scrapers (6 files)
  │   │   └── community/           Community scrapers (3 files)
  │   └── utils/
  │       ├── date.ts              Date helpers
  │       ├── formatting.ts        Number/currency formatting
  │       └── sentiment.ts         Simple keyword-based sentiment scoring
  ├── components/
  │   ├── ui/                      shadcn/ui components
  │   ├── charts/                  Chart components (Recharts)
  │   ├── tables/                  Table components (TanStack Table)
  │   └── layout/                  Sidebar, Header, Navigation
  ├── public/
  ├── drizzle.config.ts
  ├── next.config.ts               (output: 'standalone')
  ├── package.json
  ├── tsconfig.json
  └── .env.local                   API keys (see Environment Variables section)
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
    // 3. Call fetch() with retry + exponential backoff
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
  │   ├── google-trends.ts           google-trends-api npm
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
      ├── twitch-tracker.ts          TwitchTracker / Streams Charts + Twitch API
      └── news-rss.ts               PocketGamer, Mobidictum RSS
```

> Sources #27-30 (Appfigures, AppFollow, Google Play Developer API, GameAnalytics/Firebase) are optional own-app integrations. They will be implemented as needed — not part of the core scraper system since they require per-app authentication or SDK integration.

## Scheduling (Manual → Automatic)

**Phase 1 (Sprint 1-3): Manual**
- User clicks "Refresh" button on dashboard or settings page
- Triggers `/api/scraper/run-all` or individual scrapers

**Phase 2 (Sprint 4): Automatic**
- `node-cron` integrated into Next.js standalone server via custom `server.ts`
- Default schedules:
  - Market data (top charts, app details): every 6 hours
  - Ad creatives: every 12 hours
  - Community signals: every 4 hours
  - ASO keywords: daily
  - SDK intelligence: weekly
- Schedules configurable via settings page, stored in a `scraper_schedules` table

## Sprint Plan

### Sprint 1 — Foundation + 4 Sources (MVP)
1. Project scaffold (Next.js + SQLite + Drizzle + WAL mode)
2. Base scraper class with retry + rate-limit
3. Apple RSS Top Charts scraper
4. Google Play scraper (google-play-scraper npm)
5. iTunes Search API scraper (app detail)
6. Meta Ad Library scraper (basic)
7. Game add/list page + settings page
8. Basic dashboard — table view with fetched data
9. Scraper status panel

### Sprint 2 — Expansion
- SteamSpy + Steam API
- Google Ads Transparency + TikTok Creative Center
- AppBrain SDK intelligence
- Chart components (trend lines)
- Game detail page with time series

### Sprint 3 — Deepening
- ASO sources (ASOTools, ASOMobile, Asodesk)
- Reddit + Twitch community data
- Google Trends integration
- News RSS feeds
- Community signals page

### Sprint 4 — Maturation
- Remaining scrapers (GameRefinery, BigSpy, MightySignal, Similarweb)
- Automatic periodic updates (node-cron in custom server.ts)
- Data retention cleanup job
- Comparison and alert features
- Customizable dashboard widgets
