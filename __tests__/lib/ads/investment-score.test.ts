import { describe, it, expect } from "vitest";
import {
  computeInvestmentScore,
  countSiblings,
} from "@/lib/ads/investment-score";

const REFERENCE = new Date("2026-04-14T00:00:00Z");

describe("computeInvestmentScore", () => {
  it("ranks a long-running multi-country creative above a fresh one", () => {
    const veteran = computeInvestmentScore({
      firstSeen: "2026-01-01",
      lastSeen: null,
      isActive: true,
      countries: ["US", "GB", "DE", "TR", "BR"],
      platforms: ["facebook", "instagram"],
      variantSiblings: 4,
      impressionsLower: null,
      impressionsUpper: null,
      referenceDate: REFERENCE,
    });

    const fresh = computeInvestmentScore({
      firstSeen: "2026-04-10",
      lastSeen: null,
      isActive: true,
      countries: ["US"],
      platforms: ["facebook"],
      variantSiblings: 1,
      impressionsLower: null,
      impressionsUpper: null,
      referenceDate: REFERENCE,
    });

    expect(veteran.score).toBeGreaterThan(fresh.score);
    expect(veteran.daysActive).toBe(103);
    expect(fresh.daysActive).toBe(4);
  });

  it("caps inactive ad duration at its lastSeen", () => {
    const result = computeInvestmentScore({
      firstSeen: "2026-01-01",
      lastSeen: "2026-02-01",
      isActive: false,
      countries: ["US"],
      platforms: ["facebook"],
      variantSiblings: 1,
      impressionsLower: null,
      impressionsUpper: null,
      referenceDate: REFERENCE,
    });
    expect(result.daysActive).toBe(31);
  });

  it("boosts score with impression bucket data when provided", () => {
    const base = {
      firstSeen: "2026-03-01",
      lastSeen: null,
      isActive: true,
      countries: ["US"],
      platforms: ["facebook"],
      variantSiblings: 1,
      referenceDate: REFERENCE,
    };
    const withoutImpressions = computeInvestmentScore({
      ...base,
      impressionsLower: null,
      impressionsUpper: null,
    });
    const withImpressions = computeInvestmentScore({
      ...base,
      impressionsLower: 100000,
      impressionsUpper: 499999,
    });
    expect(withImpressions.score).toBeGreaterThan(withoutImpressions.score);
    expect(withImpressions.impressionsWeight).toBeGreaterThan(1);
  });

  it("returns 0 score with no usable data instead of NaN", () => {
    const result = computeInvestmentScore({
      firstSeen: null,
      lastSeen: null,
      isActive: true,
      countries: [],
      platforms: [],
      variantSiblings: 0,
      impressionsLower: null,
      impressionsUpper: null,
      referenceDate: REFERENCE,
    });
    expect(Number.isFinite(result.score)).toBe(true);
    expect(result.score).toBe(0);
  });
});

describe("countSiblings", () => {
  it("groups creatives by variantGroupId ignoring nulls", () => {
    const counts = countSiblings([
      { variantGroupId: "a" },
      { variantGroupId: "a" },
      { variantGroupId: "b" },
      { variantGroupId: null },
    ]);
    expect(counts.get("a")).toBe(2);
    expect(counts.get("b")).toBe(1);
    expect(counts.has(null)).toBe(false);
  });
});
