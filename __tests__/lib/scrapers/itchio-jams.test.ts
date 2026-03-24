import { describe, it, expect } from "vitest";
import {
  parseItchioEntry,
  ItchioJamsScraper,
} from "@/lib/scrapers/community/itchio-jams";

const mockEntry = {
  title: "Brackeys Game Jam 2026.1",
  link: "https://itch.io/jam/brackeys-game-jam-2026",
  published: "2026-03-15T00:00:00Z",
  description:
    "A week-long game jam hosted by Brackeys, open to all skill levels. Create a game based on the theme revealed at the start!",
};

describe("parseItchioEntry", () => {
  it("parses a game jam entry correctly", () => {
    const result = parseItchioEntry(mockEntry);
    expect(result.source).toBe("itchio-jams");
    expect(result.signalType).toBe("jam_theme");
    expect(result.name).toBe("Brackeys Game Jam 2026.1");
    expect(result.value).toBeNull();
    expect(result.date).toBe("2026-03-15T00:00:00Z");

    const metadata = JSON.parse(result.metadata);
    expect(metadata.url).toBe(
      "https://itch.io/jam/brackeys-game-jam-2026"
    );
    expect(metadata.description).toBe(
      "A week-long game jam hosted by Brackeys, open to all skill levels. Create a game based on the theme revealed at the start!"
    );
  });

  it("truncates description to 200 characters in metadata", () => {
    const longDesc = "B".repeat(300);
    const entry = { ...mockEntry, description: longDesc };
    const result = parseItchioEntry(entry);
    const metadata = JSON.parse(result.metadata);
    expect(metadata.description.length).toBe(200);
  });

  it("handles empty fields", () => {
    const empty = {
      title: "",
      link: "",
      published: "",
      description: "",
    };
    const result = parseItchioEntry(empty);
    expect(result.name).toBe("");
    expect(result.date).toBe("");
    const metadata = JSON.parse(result.metadata);
    expect(metadata.url).toBe("");
    expect(metadata.description).toBe("");
  });

  it("parses a trending game entry as trending signal type", () => {
    const gameEntry = {
      title: "Celeste 2: The Summit",
      link: "https://itch.io/game/celeste-2",
      published: "2026-03-20T12:00:00Z",
      description: "A challenging platformer sequel",
    };
    // When the entry is from games feed, signalType should be "trending"
    const result = parseItchioEntry(gameEntry, "trending");
    expect(result.signalType).toBe("trending");
    expect(result.name).toBe("Celeste 2: The Summit");
  });

  it("defaults signalType to jam_theme when not specified", () => {
    const result = parseItchioEntry(mockEntry);
    expect(result.signalType).toBe("jam_theme");
  });
});

describe("ItchioJamsScraper config", () => {
  it("has correct config values", () => {
    const scraper = new ItchioJamsScraper();
    expect(scraper.config.name).toBe("itchio-jams");
    expect(scraper.config.category).toBe("community");
    expect(scraper.config.rateLimit).toEqual({ requests: 1, perSeconds: 2 });
    expect(scraper.config.retryCount).toBe(2);
    expect(scraper.config.timeout).toBe(10000);
  });
});
