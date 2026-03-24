"use client";

import { useEffect, useState, useMemo } from "react";
import { TrendSignalsTable, type TrendSignalEntry } from "@/components/tables/trend-signals-table";
import { RankingChart } from "@/components/charts/ranking-chart";

interface OverviewData {
  jamSignals: number;
  googleTrends: number;
  steamTrends: number;
  youtubeSignals: number;
  recentSignals: TrendSignalEntry[];
}

interface TrendsDataPoint {
  id: number;
  appId: number;
  keyword: string;
  region: string | null;
  interestScore: number | null;
  date: string;
  appName: string;
}

const SOURCE_FILTER_OPTIONS = [
  { value: "all", label: "All Sources" },
  { value: "itchio-jams", label: "itch.io Jams" },
  { value: "trending-now", label: "TrendingNow" },
  { value: "youtube", label: "YouTube" },
  { value: "google-trends", label: "Google Trends" },
] as const;

function StatCard({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{count.toLocaleString()}</p>
    </div>
  );
}

export default function TrendsPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [googleTrendsData, setGoogleTrendsData] = useState<TrendsDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState("all");
  const [selectedKeyword, setSelectedKeyword] = useState<string>("");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/trends/overview").then((r) => r.json()),
      fetch("/api/trends?limit=500").then((r) => r.json()),
    ])
      .then(([overviewJson, trendsJson]) => {
        setOverview(overviewJson);
        const trends = Array.isArray(trendsJson) ? trendsJson : [];
        setGoogleTrendsData(trends);
        // Auto-select first keyword
        if (trends.length > 0) {
          const firstKeyword = `${trends[0].appName} - ${trends[0].keyword}`;
          setSelectedKeyword(firstKeyword);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Filter signals by source
  const filteredSignals = useMemo(() => {
    if (!overview) return [];
    if (sourceFilter === "all") return overview.recentSignals;
    return overview.recentSignals.filter((s) => s.source === sourceFilter);
  }, [overview, sourceFilter]);

  // Extract unique keyword options for chart dropdown
  const keywordOptions = useMemo(() => {
    const set = new Set<string>();
    for (const t of googleTrendsData) {
      set.add(`${t.appName} - ${t.keyword}`);
    }
    return [...set].sort();
  }, [googleTrendsData]);

  // Prepare chart data for selected keyword
  const chartData = useMemo(() => {
    if (!selectedKeyword) return [];
    const [appName, keyword] = selectedKeyword.split(" - ");
    return googleTrendsData
      .filter((t) => t.appName === appName && t.keyword === keyword)
      .map((t) => ({
        date: t.date,
        interestScore: t.interestScore,
      }));
  }, [googleTrendsData, selectedKeyword]);

  // Extract hot keywords / themes
  const hotKeywords = useMemo(() => {
    if (!overview) return [];
    const freq: Record<string, number> = {};
    for (const signal of overview.recentSignals) {
      // Use the name, but strip anything after " - " for google-trends entries
      const name = signal.source === "google-trends"
        ? signal.name.split(" - ")[0]
        : signal.name;
      freq[name] = (freq[name] ?? 0) + 1;
    }
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
  }, [overview]);

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Loading trends data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      <div>
        <h2 className="font-heading text-xl font-semibold">Trends Analysis</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Combined view of all trend signals for hit prediction.
        </p>
      </div>

      {/* A) Trend Pipeline Overview */}
      <section>
        <h3 className="mb-3 font-heading text-lg font-medium">Trend Pipeline Overview</h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Game Jam Signals" count={overview?.jamSignals ?? 0} color="text-green-600" />
          <StatCard label="Google Trends" count={overview?.googleTrends ?? 0} color="text-orange-500" />
          <StatCard label="Steam/PC Trends" count={overview?.steamTrends ?? 0} color="text-blue-600" />
          <StatCard label="YouTube Signals" count={overview?.youtubeSignals ?? 0} color="text-red-600" />
        </div>
      </section>

      {/* B) Rising Trends */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-heading text-lg font-medium">Rising Trends</h3>
          <div className="flex items-center gap-2">
            <label htmlFor="trend-source-filter" className="text-sm text-muted-foreground">
              Source:
            </label>
            <select
              id="trend-source-filter"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm"
            >
              {SOURCE_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <TrendSignalsTable data={filteredSignals} />
      </section>

      {/* C) Google Trends Chart */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-heading text-lg font-medium">Google Trends Chart</h3>
          {keywordOptions.length > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor="keyword-select" className="text-sm text-muted-foreground">
                Keyword:
              </label>
              <select
                id="keyword-select"
                value={selectedKeyword}
                onChange={(e) => setSelectedKeyword(e.target.value)}
                className="max-w-xs rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm"
              >
                {keywordOptions.map((kw) => (
                  <option key={kw} value={kw}>
                    {kw}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        {chartData.length > 0 ? (
          <RankingChart data={chartData} dataKey="interestScore" label="Interest Score" />
        ) : (
          <p className="text-sm text-muted-foreground">
            No Google Trends data available. Data will appear once the Google Trends scraper runs.
          </p>
        )}
      </section>

      {/* D) Hot Keywords / Themes */}
      <section>
        <h3 className="mb-3 font-heading text-lg font-medium">Hot Keywords / Themes</h3>
        {hotKeywords.length === 0 ? (
          <p className="text-sm text-muted-foreground">No keywords to display yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {hotKeywords.map(([keyword, count]) => (
              <span
                key={keyword}
                className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-medium"
              >
                {keyword}
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                  {count}
                </span>
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
