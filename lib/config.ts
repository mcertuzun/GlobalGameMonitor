export const SCRAPER_LIMITS = {
  topChartsPerChart: 50, // Only store top 50 per chart (not 100)
  maxTrackedApps: 500, // Max apps in DB
  retentionDays: 30, // Keep data for 30 days
  maxSnapshotsPerApp: 30, // Max snapshots per app
  skipDuplicateSnapshots: true, // Don't insert if snapshot exists for today
  maxRedditApps: 10, // Max apps to fetch Reddit data for (own games + first N others)
  maxNewsItemsPerFeed: 20, // Max news items to fetch per RSS feed
};
