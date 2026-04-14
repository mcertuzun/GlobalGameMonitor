/**
 * Rising-games detector — finds apps whose chart rank jumped sharply over the
 * lookback window, including brand-new entries. Works entirely off the
 * `topCharts` table: no external API calls, no attribution data.
 *
 * Signals combined into a single `momentum` score:
 *   - rankDelta: oldRank - newRank (positive = climbed)
 *   - countriesRising: how many countries show a jump
 *   - newEntryBonus: bonus for apps that weren't in the chart N days ago
 *
 * Intentionally pure — callers hand in the raw snapshot rows, we return a
 * ranked list. Keeps the module trivially testable.
 */

export interface ChartSnapshotRow {
  appId: number;
  appName: string;
  iconUrl: string | null;
  store: string;
  country: string;
  chartType: string;
  rank: number;
  date: string; // YYYY-MM-DD
}

export interface RisingGame {
  appId: number;
  appName: string;
  iconUrl: string | null;
  store: string;
  chartType: string;
  newRank: number;           // best rank across countries today
  oldRank: number | null;    // worst rank across countries at lookback (null = new)
  rankDelta: number;         // positive = rose
  countriesRising: number;
  countriesTotal: number;
  isNewEntry: boolean;
  momentum: number;
  perCountry: {
    country: string;
    newRank: number | null;
    oldRank: number | null;
    delta: number | null;
  }[];
}

export interface RisingConfig {
  lookbackDays: number;
  minJump: number;
  topN: number;
  includeNewEntries: boolean;
}

/** Return the snapshot date closest to `targetDate` but not after it. */
function pickDate(dates: string[], targetDate: string): string | null {
  const sorted = [...new Set(dates)].sort();
  let chosen: string | null = null;
  for (const d of sorted) {
    if (d <= targetDate) chosen = d;
    else break;
  }
  return chosen;
}

/**
 * Groups rows by (appId, chartType, country), then compares best available
 * rank today vs. best available rank N days ago (or the nearest earlier
 * snapshot). Works with sparse histories.
 */
export function detectRisingGames(
  rows: ChartSnapshotRow[],
  cfg: RisingConfig,
  referenceDate: Date = new Date()
): RisingGame[] {
  if (rows.length === 0) return [];

  const today = referenceDate.toISOString().slice(0, 10);
  const lookback = new Date(referenceDate);
  lookback.setUTCDate(lookback.getUTCDate() - cfg.lookbackDays);
  const lookbackDate = lookback.toISOString().slice(0, 10);

  const allDates = [...new Set(rows.map((r) => r.date))].sort();
  const todayDate = pickDate(allDates, today) ?? allDates[allDates.length - 1];
  const oldDate = pickDate(allDates, lookbackDate);

  if (!todayDate) return [];

  // Build: appId → chartType → country → { newRank, oldRank }
  type Pair = { newRank: number | null; oldRank: number | null };
  const index = new Map<string, {
    meta: Pick<ChartSnapshotRow, "appId" | "appName" | "iconUrl" | "store" | "chartType">;
    countries: Map<string, Pair>;
  }>();

  const key = (appId: number, chartType: string, store: string) =>
    `${store}|${chartType}|${appId}`;

  for (const r of rows) {
    if (r.date !== todayDate && r.date !== oldDate) continue;
    const k = key(r.appId, r.chartType, r.store);
    if (!index.has(k)) {
      index.set(k, {
        meta: {
          appId: r.appId,
          appName: r.appName,
          iconUrl: r.iconUrl,
          store: r.store,
          chartType: r.chartType,
        },
        countries: new Map(),
      });
    }
    const bucket = index.get(k)!;
    const pair = bucket.countries.get(r.country) ?? {
      newRank: null,
      oldRank: null,
    };
    if (r.date === todayDate) {
      pair.newRank = pair.newRank === null ? r.rank : Math.min(pair.newRank, r.rank);
    } else if (r.date === oldDate) {
      pair.oldRank = pair.oldRank === null ? r.rank : Math.min(pair.oldRank, r.rank);
    }
    bucket.countries.set(r.country, pair);
  }

  const risers: RisingGame[] = [];

  for (const { meta, countries } of index.values()) {
    let bestNew = Infinity;
    let worstOld: number | null = null;
    let countriesRising = 0;
    let countriesTotal = 0;
    const perCountry: RisingGame["perCountry"] = [];

    for (const [country, { newRank, oldRank }] of countries) {
      if (newRank === null) continue;
      countriesTotal += 1;
      bestNew = Math.min(bestNew, newRank);
      if (oldRank !== null) {
        worstOld = worstOld === null ? oldRank : Math.max(worstOld, oldRank);
      }
      const delta = oldRank !== null ? oldRank - newRank : null;
      if (delta !== null && delta >= cfg.minJump) countriesRising += 1;
      if (oldRank === null && cfg.includeNewEntries) countriesRising += 1;
      perCountry.push({ country, newRank, oldRank, delta });
    }

    if (bestNew === Infinity) continue;

    const isNewEntry = worstOld === null;
    if (isNewEntry && !cfg.includeNewEntries) continue;

    const rankDelta = worstOld !== null ? worstOld - bestNew : cfg.minJump;
    const qualifies =
      (isNewEntry && cfg.includeNewEntries) ||
      (worstOld !== null && rankDelta >= cfg.minJump);

    if (!qualifies) continue;

    const newEntryBonus = isNewEntry ? 50 : 0;
    const momentum =
      rankDelta * Math.max(1, countriesRising) + newEntryBonus;

    risers.push({
      appId: meta.appId,
      appName: meta.appName,
      iconUrl: meta.iconUrl,
      store: meta.store,
      chartType: meta.chartType,
      newRank: bestNew,
      oldRank: worstOld,
      rankDelta,
      countriesRising,
      countriesTotal,
      isNewEntry,
      momentum,
      perCountry: perCountry.sort((a, b) =>
        (b.delta ?? 0) - (a.delta ?? 0)
      ),
    });
  }

  risers.sort((a, b) => b.momentum - a.momentum);
  return risers.slice(0, cfg.topN);
}
