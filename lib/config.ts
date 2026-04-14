export const SCRAPER_LIMITS = {
  // Legacy default. Top-chart scrapers now read cfg.topN from chart_config
  // settings; this fallback is only used by non-chart scrapers that reference
  // the constant directly.
  topChartsPerChart: 300,
  maxTrackedApps: 5000, // Max apps in DB — bumped for 300×N-country discovery
  retentionDays: 30, // Keep data for 30 days
  maxSnapshotsPerApp: 30, // Max snapshots per app
  skipDuplicateSnapshots: true, // Don't insert if snapshot exists for today
  maxRedditApps: 10, // Max apps to fetch Reddit data for (own games + first N others)
  maxNewsItemsPerFeed: 20, // Max news items to fetch per RSS feed
  youtube: {
    maxAppsToSearch: 10,
    maxResultsPerSearch: 5,
  },
  reviews: {
    maxAppsToFetch: 10,
    maxReviewsPerApp: 50,
  },
  keywords: {
    searchResultsPerKeyword: 20,
  },
};
