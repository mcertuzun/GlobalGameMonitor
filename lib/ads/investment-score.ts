/**
 * Creative investment score — a SensorTower-style proxy for how much a game is
 * spending on a specific ad variant.
 *
 * We have no direct spend data. Instead we combine the signals that correlate
 * with ad-spend weight:
 *   - daysActive: how long the creative has stayed in rotation
 *   - countriesCount: geographic breadth
 *   - platformsCount: how many ad surfaces the creative runs on (fb/ig/audience)
 *   - variantSiblings: how many sibling variants share the same group
 *   - impressionsUpper: Meta's declared impression bucket upper bound (when available)
 *
 * score = daysActive * log2(countries+1) * (platforms or 1) * log2(variants+1)
 *         * impressionsWeight
 *
 * impressionsWeight defaults to 1 and only activates when Meta returns bucket
 * data (political / EU-disclosed ads). For non-EU gaming creatives it's absent
 * and the score is driven by longevity + breadth alone.
 */
export interface InvestmentInput {
  firstSeen: string | null;
  lastSeen: string | null;
  isActive: boolean | null;
  countries: string[];
  platforms: string[];
  variantSiblings: number;
  impressionsLower: number | null;
  impressionsUpper: number | null;
  /** Used as "now" for testability. Defaults to new Date(). */
  referenceDate?: Date;
}

export interface InvestmentOutput {
  daysActive: number;
  countriesCount: number;
  platformsCount: number;
  variantCount: number;
  impressionsWeight: number;
  score: number;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function parseDate(s: string | null | undefined): number | null {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

function log2p1(n: number): number {
  return Math.log2(Math.max(n, 0) + 1);
}

export function computeInvestmentScore(
  input: InvestmentInput
): InvestmentOutput {
  const now = (input.referenceDate ?? new Date()).getTime();
  const start = parseDate(input.firstSeen);
  const stop = parseDate(input.lastSeen);
  const end = input.isActive === false && stop ? stop : now;

  const daysActive =
    start === null ? 1 : Math.max(1, Math.round((end - start) / MS_PER_DAY));

  const countriesCount = input.countries.length;
  const platformsCount = Math.max(input.platforms.length, 1);
  const variantCount = Math.max(input.variantSiblings, 1);

  const impressionsMid =
    input.impressionsUpper && input.impressionsLower
      ? (input.impressionsUpper + input.impressionsLower) / 2
      : input.impressionsUpper ?? input.impressionsLower ?? 0;
  const impressionsWeight =
    impressionsMid > 0 ? 1 + Math.log10(impressionsMid) / 2 : 1;

  const score =
    daysActive *
    log2p1(countriesCount) *
    platformsCount *
    log2p1(variantCount) *
    impressionsWeight;

  return {
    daysActive,
    countriesCount,
    platformsCount,
    variantCount,
    impressionsWeight,
    score: Number.isFinite(score) ? score : 0,
  };
}

/**
 * Group creatives by variantGroupId so sibling counts can feed into the score.
 */
export function countSiblings<T extends { variantGroupId: string | null }>(
  creatives: T[]
): Map<string | null, number> {
  const counts = new Map<string | null, number>();
  for (const c of creatives) {
    const key = c.variantGroupId ?? null;
    if (key === null) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
