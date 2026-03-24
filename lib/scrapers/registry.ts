import { BaseScraper } from "./base-scraper";
import { AppleTopChartsScraper } from "./market/apple-top-charts";
import { AppleAppDetailScraper } from "./market/apple-app-detail";
import { GooglePlayDetailScraper } from "./market/google-play-detail";
import { GooglePlayTopChartsScraper } from "./market/google-play-top-charts";
import { MetaAdLibraryScraper } from "./ads/meta-ad-library";
import { SteamSpyScraper } from "./market/steamspy";
import { SteamApiScraper } from "./market/steam-api";

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
registerScraper(new MetaAdLibraryScraper() as BaseScraper<unknown>);
registerScraper(new SteamSpyScraper() as BaseScraper<unknown>);
registerScraper(new SteamApiScraper() as BaseScraper<unknown>);
