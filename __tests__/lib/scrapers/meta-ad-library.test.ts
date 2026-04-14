import { describe, it, expect } from "vitest";
import { parseMetaAdResult } from "@/lib/scrapers/ads/meta-ad-library";

describe("parseMetaAdResult", () => {
  it("parses a legacy-shape Meta Ad Library result", () => {
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

  it("parses a real Graph API ads_archive payload with impressions + countries", () => {
    const raw = {
      id: "9876543210",
      page_id: "111",
      page_name: "Supercell",
      ad_creative_bodies: ["New hero has landed!"],
      ad_creative_link_titles: ["Clash of Clans"],
      ad_creative_link_captions: ["Install"],
      ad_snapshot_url:
        "https://www.facebook.com/ads/archive/render_ad/?id=9876543210&video=1",
      ad_delivery_start_time: "2026-02-01",
      ad_delivery_stop_time: "2026-04-10",
      publisher_platforms: ["facebook", "instagram"],
      countries: ["US", "gb", "de"],
      impressions: { lower_bound: "100000", upper_bound: "499999" },
    };

    const result = parseMetaAdResult(raw, "com.supercell.clashofclans");
    expect(result.creativeType).toBe("video");
    expect(result.countries).toEqual(["US", "GB", "DE"]);
    expect(result.publisherPlatforms).toEqual(["facebook", "instagram"]);
    expect(result.impressionsLower).toBe(100000);
    expect(result.impressionsUpper).toBe(499999);
    expect(result.isActive).toBe(false); // stop_time present
    expect(result.firstSeen).toBe("2026-02-01");
    expect(result.lastSeen).toBe("2026-04-10");
  });

  it("treats ads without stop_time as active", () => {
    const raw = {
      id: "1",
      page_name: "X",
      ad_creative_bodies: [],
      ad_snapshot_url: "https://example.com/img.png",
      ad_delivery_start_time: "2026-03-01",
    };
    const result = parseMetaAdResult(raw, "com.x.y");
    expect(result.isActive).toBe(true);
    expect(result.creativeType).toBe("image");
  });
});
