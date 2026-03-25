import { BaseScraper } from "./base-scraper";
import { AppleTopChartsScraper } from "./market/apple-top-charts";
import { AppleAppDetailScraper } from "./market/apple-app-detail";
import { GooglePlayDetailScraper } from "./market/google-play-detail";
import { GooglePlayTopChartsScraper } from "./market/google-play-top-charts";
import { GooglePlaySubcategoryChartsScraper } from "./market/google-play-subcategory-charts";
import { MetaAdLibraryScraper } from "./ads/meta-ad-library";
import { GoogleAdsTransparencyScraper } from "./ads/google-ads-transparency";
import { TikTokCreativeScraper } from "./ads/tiktok-creative";
import { AppBrainSdkScraper } from "./ads/appbrain-sdk";
import { SteamSpyScraper } from "./market/steamspy";
import { SteamSpyTrendsScraper } from "./market/steamspy-trends";
import { SteamApiScraper } from "./market/steam-api";
import { RedditScraper } from "./community/reddit";
import { TwitchTrackerScraper } from "./community/twitch-tracker";
import { GoogleTrendsScraper } from "./competitor/google-trends";
import { NewsRssScraper } from "./community/news-rss";
import { RawgScraper } from "./competitor/rawg";
import { ItchioJamsScraper } from "./community/itchio-jams";
import { TrendingNowScraper } from "./competitor/trending-now";
import { YouTubeScraper } from "./community/youtube";
import { ReviewsScraper } from "./market/reviews";
import { SimilarAppsScraper } from "./market/similar-apps";
import { KeywordScorerScraper } from "./competitor/keyword-scorer";

const scraperRegistry = new Map<string, BaseScraper<unknown>>();

export function registerScraper(scraper: BaseScraper<unknown>): void {
  scraperRegistry.set(scraper.config.name, scraper);
}

export function getScraper(name: string): BaseScraper<unknown> | undefined {
  return scraperRegistry.get(name);
}

export function getAllScrapers(): BaseScraper<unknown>[] {
  return Array.from(scraperRegistry.values());
}

export function getScraperNames(): string[] {
  return Array.from(scraperRegistry.keys());
}

// Register all scrapers
registerScraper(new AppleTopChartsScraper() as BaseScraper<unknown>);
registerScraper(new AppleAppDetailScraper() as BaseScraper<unknown>);
registerScraper(new GooglePlayDetailScraper() as BaseScraper<unknown>);
registerScraper(new GooglePlayTopChartsScraper() as BaseScraper<unknown>);
registerScraper(new GooglePlaySubcategoryChartsScraper() as BaseScraper<unknown>);
registerScraper(new MetaAdLibraryScraper() as BaseScraper<unknown>);
registerScraper(new GoogleAdsTransparencyScraper() as BaseScraper<unknown>);
registerScraper(new TikTokCreativeScraper() as BaseScraper<unknown>);
registerScraper(new AppBrainSdkScraper() as BaseScraper<unknown>);
registerScraper(new SteamSpyScraper() as BaseScraper<unknown>);
registerScraper(new SteamSpyTrendsScraper() as BaseScraper<unknown>);
registerScraper(new SteamApiScraper() as BaseScraper<unknown>);
registerScraper(new RedditScraper() as BaseScraper<unknown>);
registerScraper(new TwitchTrackerScraper() as BaseScraper<unknown>);
registerScraper(new GoogleTrendsScraper() as BaseScraper<unknown>);
registerScraper(new NewsRssScraper() as BaseScraper<unknown>);
registerScraper(new RawgScraper() as BaseScraper<unknown>);
registerScraper(new ItchioJamsScraper() as BaseScraper<unknown>);
registerScraper(new TrendingNowScraper() as BaseScraper<unknown>);
registerScraper(new YouTubeScraper() as BaseScraper<unknown>);
registerScraper(new ReviewsScraper() as BaseScraper<unknown>);
registerScraper(new SimilarAppsScraper() as BaseScraper<unknown>);
registerScraper(new KeywordScorerScraper() as BaseScraper<unknown>);
