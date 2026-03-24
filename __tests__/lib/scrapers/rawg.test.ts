import { describe, it, expect } from "vitest";
import { parseRawgGame, RawgScraper } from "@/lib/scrapers/competitor/rawg";

const mockRawgGame = {
  id: 3498,
  name: "Grand Theft Auto V",
  genres: [{ name: "Action" }, { name: "Adventure" }],
  tags: [
    { name: "Open World" },
    { name: "Multiplayer" },
    { name: "Third Person" },
    { name: "Crime" },
    { name: "Sandbox" },
    { name: "Shooter" },
    { name: "Exploration" },
    { name: "Action" },
    { name: "Story Rich" },
    { name: "RPG" },
    { name: "Singleplayer" },
    { name: "Comedy" },
  ],
  platforms: [
    { platform: { name: "PC" } },
    { platform: { name: "PlayStation 5" } },
    { platform: { name: "Xbox Series S/X" } },
  ],
  rating: 4.47,
  ratings_count: 6580,
  released: "2013-09-17",
  developers: [{ name: "Rockstar North" }, { name: "Rockstar Games" }],
  publishers: [{ name: "Rockstar Games" }],
  description_raw:
    "Rockstar Games went bigger, extract from here. " + "A".repeat(600),
  background_image: "https://media.rawg.io/media/games/456/gta5.jpg",
  metacritic: 92,
  playtime: 73,
};

describe("parseRawgGame", () => {
  it("parses RAWG API result correctly", () => {
    const result = parseRawgGame(mockRawgGame);
    expect(result.source).toBe("rawg");
    expect(result.sourceId).toBe("3498");
    expect(result.name).toBe("Grand Theft Auto V");
    expect(result.genres).toBe("Action, Adventure");
    expect(result.platforms).toBe("PC, PlayStation 5, Xbox Series S/X");
    expect(result.rating).toBe(4.47);
    expect(result.ratingCount).toBe(6580);
    expect(result.releaseDate).toBe("2013-09-17");
    expect(result.developer).toBe("Rockstar North");
    expect(result.publisher).toBe("Rockstar Games");
    expect(result.imageUrl).toBe(
      "https://media.rawg.io/media/games/456/gta5.jpg"
    );
    expect(result.metacriticScore).toBe(92);
    expect(result.playtime).toBe(73);
  });

  it("limits tags to first 10", () => {
    const result = parseRawgGame(mockRawgGame);
    const tagList = result.tags!.split(", ");
    expect(tagList.length).toBe(10);
    expect(tagList[0]).toBe("Open World");
    expect(tagList[9]).toBe("RPG");
  });

  it("truncates description to 500 characters", () => {
    const result = parseRawgGame(mockRawgGame);
    expect(result.description!.length).toBe(500);
  });

  it("handles missing optional fields", () => {
    const minimal = {
      id: 999,
      name: "Test Game",
      genres: [],
      tags: [],
      platforms: [],
      rating: 0,
      ratings_count: 0,
      released: null,
      developers: [],
      publishers: [],
      description_raw: "",
      background_image: null,
      metacritic: null,
      playtime: 0,
    };

    const result = parseRawgGame(minimal);
    expect(result.sourceId).toBe("999");
    expect(result.name).toBe("Test Game");
    expect(result.genres).toBe("");
    expect(result.tags).toBe("");
    expect(result.platforms).toBe("");
    expect(result.developer).toBeNull();
    expect(result.publisher).toBeNull();
    expect(result.description).toBe("");
    expect(result.imageUrl).toBeNull();
    expect(result.metacriticScore).toBeNull();
  });

  it("handles single developer and publisher", () => {
    const singleDev = {
      ...mockRawgGame,
      developers: [{ name: "Solo Dev Studio" }],
      publishers: [{ name: "Indie Publisher" }],
    };

    const result = parseRawgGame(singleDev);
    expect(result.developer).toBe("Solo Dev Studio");
    expect(result.publisher).toBe("Indie Publisher");
  });
});

describe("RawgScraper config", () => {
  it("has correct config values", () => {
    const scraper = new RawgScraper();
    expect(scraper.config.name).toBe("rawg");
    expect(scraper.config.category).toBe("competitor");
    expect(scraper.config.rateLimit).toEqual({ requests: 1, perSeconds: 2 });
    expect(scraper.config.retryCount).toBe(2);
    expect(scraper.config.timeout).toBe(10000);
  });
});
