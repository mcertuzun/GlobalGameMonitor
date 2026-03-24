import { describe, it, expect } from "vitest";
import {
  parseAppBrainSdkEntry,
  AppBrainSdkScraper,
} from "@/lib/scrapers/ads/appbrain-sdk";

describe("parseAppBrainSdkEntry", () => {
  it("parses a valid SDK entry with known category", () => {
    const raw = {
      appId: "com.example.game",
      sdkName: "AdMob",
      sdkCategory: "ads",
      detectedDate: "2026-03-01",
    };

    const result = parseAppBrainSdkEntry(raw);

    expect(result).toEqual({
      storeId: "com.example.game",
      sdkName: "AdMob",
      sdkCategory: "ads",
      detectedAt: "2026-03-01",
    });
  });

  it("maps 'analytics' category correctly", () => {
    const raw = {
      appId: "com.test.app",
      sdkName: "Firebase Analytics",
      sdkCategory: "analytics",
      detectedDate: "2026-02-15",
    };

    const result = parseAppBrainSdkEntry(raw);
    expect(result.sdkCategory).toBe("analytics");
  });

  it("maps 'attribution' category correctly", () => {
    const raw = {
      appId: "com.test.app",
      sdkName: "AppsFlyer",
      sdkCategory: "attribution",
      detectedDate: "2026-02-15",
    };

    const result = parseAppBrainSdkEntry(raw);
    expect(result.sdkCategory).toBe("attribution");
  });

  it("maps 'crash' category correctly", () => {
    const raw = {
      appId: "com.test.app",
      sdkName: "Crashlytics",
      sdkCategory: "crash",
      detectedDate: "2026-02-15",
    };

    const result = parseAppBrainSdkEntry(raw);
    expect(result.sdkCategory).toBe("crash");
  });

  it("defaults unknown categories to 'other'", () => {
    const raw = {
      appId: "com.test.app",
      sdkName: "SomeSDK",
      sdkCategory: "social-login",
      detectedDate: "2026-01-01",
    };

    const result = parseAppBrainSdkEntry(raw);
    expect(result.sdkCategory).toBe("other");
  });

  it("defaults empty category to 'other'", () => {
    const raw = {
      appId: "com.test.app",
      sdkName: "UnknownSDK",
      sdkCategory: "",
      detectedDate: "2026-01-01",
    };

    const result = parseAppBrainSdkEntry(raw);
    expect(result.sdkCategory).toBe("other");
  });
});

describe("AppBrainSdkScraper", () => {
  it("has correct config", () => {
    const scraper = new AppBrainSdkScraper();

    expect(scraper.config.name).toBe("appbrain-sdk");
    expect(scraper.config.category).toBe("ads");
    expect(scraper.config.rateLimit).toEqual({ requests: 1, perSeconds: 3 });
    expect(scraper.config.retryCount).toBe(2);
    expect(scraper.config.timeout).toBe(15000);
  });
});
