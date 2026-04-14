/**
 * Cluster creative re-uploads / localized copies of the same concept under one
 * variantGroupId, so the investment-score can reward "many localized variants
 * of the same ad" — a strong signal of UA commitment, per SensorTower's
 * methodology.
 *
 * We don't have access to raw video frames in the Meta Ad Library API (only a
 * snapshot URL), so we cluster by textual fingerprint: a normalized hash of
 * (appId, headline-shingles, adCopy-shingles). Different localizations of the
 * same creative usually share the headline shape; minor wording tweaks still
 * cluster together.
 */

import { createHash } from "node:crypto";

const STOP_CHARS = /[^a-z0-9]+/gi;

function normalize(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .replace(STOP_CHARS, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 12) // first 12 meaningful tokens
    .join(" ");
}

/**
 * Build a stable group id from the app + textual fingerprint. Two creatives
 * with the same (appId, normalized headline, normalized adCopy prefix) land
 * in the same group.
 */
export function variantGroupIdFor(input: {
  appId: number;
  headline: string | null | undefined;
  adCopy: string | null | undefined;
}): string {
  const fingerprint = [
    `app:${input.appId}`,
    `h:${normalize(input.headline)}`,
    `c:${normalize(input.adCopy).slice(0, 80)}`,
  ].join("|");
  return createHash("sha1").update(fingerprint).digest("hex").slice(0, 16);
}
