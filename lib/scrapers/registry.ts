import { BaseScraper } from "./base-scraper";

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
