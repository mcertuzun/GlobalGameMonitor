import { describe, it, expect } from "vitest";
import { parseAppLovinShowcase } from "@/lib/scrapers/ads/applovin-playables";

describe("parseAppLovinShowcase", () => {
  it("extracts cards with iframe previews", () => {
    const html = `
      <div class="showcase-item">
        <h3 class="title">Coin Master</h3>
        <iframe src="https://playables.applovin.com/coin-master/index.html"></iframe>
        <img src="https://cdn.applovin.com/coin-thumb.png" />
      </div>
      <div class="showcase-item">
        <h3 class="title">Royal Match</h3>
        <iframe src="https://playables.applovin.com/royal/index.html"></iframe>
      </div>
    `;
    const entries = parseAppLovinShowcase(html);
    expect(entries).toHaveLength(2);
    expect(entries[0].matchedAppName).toBe("Coin Master");
    expect(entries[0].creativeUrl).toBe(
      "https://playables.applovin.com/coin-master/index.html"
    );
    expect(entries[0].thumbnailUrl).toBe(
      "https://cdn.applovin.com/coin-thumb.png"
    );
  });

  it("falls back to anchor href when no iframe is present", () => {
    const html = `
      <div class="ad-card">
        <h4 class="title">Puzzles & Survival</h4>
        <a href="/ad-experiences/puzzles-survival/">Try it</a>
      </div>
    `;
    const entries = parseAppLovinShowcase(html);
    expect(entries).toHaveLength(1);
    expect(entries[0].creativeUrl).toBe(
      "https://www.applovin.com/ad-experiences/puzzles-survival/"
    );
  });

  it("filters out non-ad anchors like contact or blog links", () => {
    const html = `
      <div class="ad-card">
        <h3 class="title">Any Game</h3>
        <a href="/contact">Contact us</a>
      </div>
    `;
    const entries = parseAppLovinShowcase(html);
    expect(entries).toHaveLength(0);
  });

  it("dedupes repeated (title,url) pairs", () => {
    const html = `
      <div class="showcase-item">
        <h3 class="title">Dup</h3>
        <iframe src="https://example.com/dup"></iframe>
      </div>
      <div class="showcase-item">
        <h3 class="title">Dup</h3>
        <iframe src="https://example.com/dup"></iframe>
      </div>
    `;
    const entries = parseAppLovinShowcase(html);
    expect(entries).toHaveLength(1);
  });

  it("returns empty array on unrelated HTML without throwing", () => {
    const entries = parseAppLovinShowcase("<html><body><p>nothing here</p></body></html>");
    expect(entries).toEqual([]);
  });
});
