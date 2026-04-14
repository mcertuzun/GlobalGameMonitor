import { describe, it, expect } from "vitest";
import { variantGroupIdFor } from "@/lib/ads/variant-grouping";

describe("variantGroupIdFor", () => {
  it("returns the same id for identical inputs", () => {
    const a = variantGroupIdFor({ appId: 1, headline: "Play now", adCopy: "Save the kingdom" });
    const b = variantGroupIdFor({ appId: 1, headline: "Play now", adCopy: "Save the kingdom" });
    expect(a).toBe(b);
  });

  it("treats minor casing/punctuation as the same variant family", () => {
    const a = variantGroupIdFor({ appId: 1, headline: "Play Now!", adCopy: "Save the kingdom!" });
    const b = variantGroupIdFor({ appId: 1, headline: "PLAY NOW", adCopy: "Save the kingdom" });
    expect(a).toBe(b);
  });

  it("produces different ids for different apps with the same copy", () => {
    const a = variantGroupIdFor({ appId: 1, headline: "Play now", adCopy: "Save the kingdom" });
    const b = variantGroupIdFor({ appId: 2, headline: "Play now", adCopy: "Save the kingdom" });
    expect(a).not.toBe(b);
  });

  it("produces different ids when meaningful text changes", () => {
    const a = variantGroupIdFor({ appId: 1, headline: "Build empire", adCopy: "Free download" });
    const b = variantGroupIdFor({ appId: 1, headline: "Destroy empire", adCopy: "Free download" });
    expect(a).not.toBe(b);
  });

  it("handles null and empty values without throwing", () => {
    expect(() => variantGroupIdFor({ appId: 1, headline: null, adCopy: null })).not.toThrow();
    expect(() => variantGroupIdFor({ appId: 1, headline: "", adCopy: "" })).not.toThrow();
  });

  it("returns a 16-char hex id", () => {
    const id = variantGroupIdFor({ appId: 1, headline: "x", adCopy: "y" });
    expect(id).toMatch(/^[a-f0-9]{16}$/);
  });
});
