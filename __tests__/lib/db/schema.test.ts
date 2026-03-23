import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";

let sqlite: Database.Database;
let db: ReturnType<typeof drizzle>;

beforeAll(() => {
  sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "./lib/db/migrations" });
});

afterAll(() => {
  sqlite.close();
});

describe("apps table", () => {
  it("should insert and retrieve an app", () => {
    db.insert(schema.apps).values({
      store: "playstore",
      storeId: "com.example.game",
      name: "Example Game",
      developer: "Example Dev",
      category: "casual",
      isOwnGame: true,
    }).run();

    const result = db.select().from(schema.apps).where(eq(schema.apps.storeId, "com.example.game")).get();
    expect(result).toBeDefined();
    expect(result!.name).toBe("Example Game");
    expect(result!.isOwnGame).toBe(true);
  });

  it("should enforce unique store+storeId constraint", () => {
    expect(() => {
      db.insert(schema.apps).values({
        store: "playstore",
        storeId: "com.example.game",
        name: "Duplicate",
      }).run();
    }).toThrow();
  });
});

describe("market_snapshots table", () => {
  it("should insert a snapshot linked to an app", () => {
    const app = db.select().from(schema.apps).where(eq(schema.apps.storeId, "com.example.game")).get();

    db.insert(schema.marketSnapshots).values({
      appId: app!.id,
      source: "google-play-scraper",
      date: "2026-03-23",
      rating: 4.5,
      ratingCount: 1000,
      downloadsEstimate: 500000,
    }).run();

    const snapshots = db.select().from(schema.marketSnapshots).where(eq(schema.marketSnapshots.appId, app!.id)).all();
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].rating).toBe(4.5);
  });
});

describe("top_charts table", () => {
  it("should enforce unique chart entry per day/rank", () => {
    const app = db.select().from(schema.apps).where(eq(schema.apps.storeId, "com.example.game")).get();

    db.insert(schema.topCharts).values({
      store: "playstore",
      country: "US",
      category: "casual",
      chartType: "free",
      date: "2026-03-23",
      rank: 1,
      appId: app!.id,
    }).run();

    expect(() => {
      db.insert(schema.topCharts).values({
        store: "playstore",
        country: "US",
        category: "casual",
        chartType: "free",
        date: "2026-03-23",
        rank: 1,
        appId: app!.id,
      }).run();
    }).toThrow();
  });
});

describe("scraper_runs table", () => {
  it("should log a scraper run", () => {
    db.insert(schema.scraperRuns).values({
      scraperName: "apple-top-charts",
      startedAt: new Date().toISOString(),
      status: "running",
    }).run();

    const runs = db.select().from(schema.scraperRuns).all();
    expect(runs.length).toBeGreaterThan(0);
    expect(runs[0].status).toBe("running");
  });
});
