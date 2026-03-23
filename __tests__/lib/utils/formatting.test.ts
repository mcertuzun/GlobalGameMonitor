import { describe, it, expect } from "vitest";
import { formatNumber, formatDate, parseDownloadRange, timeAgo } from "@/lib/utils/formatting";

describe("formatNumber", () => {
  it("formats thousands", () => expect(formatNumber(1500)).toBe("1.5K"));
  it("formats millions", () => expect(formatNumber(2500000)).toBe("2.5M"));
  it("formats small numbers", () => expect(formatNumber(500)).toBe("500"));
});

describe("formatDate", () => {
  it("formats ISO date", () => expect(formatDate("2026-03-23T00:00:00Z")).toBe("Mar 23, 2026"));
});

describe("parseDownloadRange", () => {
  it("parses '1,000,000+'", () => expect(parseDownloadRange("1,000,000+")).toBe(1000000));
  it("parses '10M+'", () => expect(parseDownloadRange("10M+")).toBe(10000000));
  it("parses '500K+'", () => expect(parseDownloadRange("500K+")).toBe(500000));
  it("returns 0 for unknown", () => expect(parseDownloadRange("")).toBe(0));
});

describe("timeAgo", () => {
  it("shows minutes ago", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(timeAgo(fiveMinAgo)).toBe("5m ago");
  });
  it("shows hours ago", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(twoHoursAgo)).toBe("2h ago");
  });
});
