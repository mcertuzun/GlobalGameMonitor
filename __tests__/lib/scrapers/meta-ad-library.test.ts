import { describe, it, expect } from "vitest";
import { parseMetaAdResult } from "@/lib/scrapers/ads/meta-ad-library";

describe("parseMetaAdResult", () => {
  it("parses a Meta Ad Library result", () => {
    const raw = {
      adId: "123456",
      pageId: "supercell",
      pageName: "Supercell",
      adCreativeBody: "Download Clash of Clans now!",
      adCreativeLinkTitle: "Clash of Clans - Free Download",
      adCreativeLinkCaption: "Play Now",
      adCreativeImageUrl: "https://example.com/ad.jpg",
      adStartDate: "2026-03-01",
      isActive: true,
    };

    const result = parseMetaAdResult(raw, "com.supercell.clashofclans");
    expect(result.platform).toBe("meta");
    expect(result.adCopy).toBe("Download Clash of Clans now!");
    expect(result.headline).toBe("Clash of Clans - Free Download");
    expect(result.isActive).toBe(true);
  });
});
