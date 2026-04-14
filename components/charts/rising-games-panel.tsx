"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface RisingGame {
  appId: number;
  appName: string;
  iconUrl: string | null;
  store: string;
  chartType: string;
  newRank: number;
  oldRank: number | null;
  rankDelta: number;
  countriesRising: number;
  countriesTotal: number;
  isNewEntry: boolean;
  momentum: number;
}

interface RisingResponse {
  generatedAt: string;
  config: {
    lookbackDays: number;
    minJump: number;
    topN: number;
    chartType: string;
    store: string | null;
    includeNewEntries: boolean;
  };
  count: number;
  risers: RisingGame[];
}

interface Props {
  store?: "playstore" | "appstore";
  chartType?: string;
  limit?: number;
}

export function RisingGamesPanel({
  store,
  chartType = "free",
  limit = 50,
}: Props) {
  const [data, setData] = useState<RisingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (store) params.set("store", store);
    if (chartType) params.set("chartType", chartType);
    params.set("topN", String(limit));

    fetch(`/api/rising-games?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: RisingResponse) => setData(json))
      .catch((err) => setError(err.message ?? "Failed to load"))
      .finally(() => setLoading(false));
  }, [store, chartType, limit]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Rising Games</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Rising Games</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Couldn&apos;t load risers{error ? `: ${error}` : ""}.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (data.risers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Rising Games</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No risers over the last {data.config.lookbackDays} days. Let the
            top-charts scraper run a few more days to build history.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Rising Games</span>
          <span className="text-xs font-normal text-muted-foreground">
            last {data.config.lookbackDays}d · min jump {data.config.minJump} ·{" "}
            {data.count} risers
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.risers.map((r, idx) => (
          <div
            key={`${r.store}-${r.appId}`}
            className="flex items-center gap-3 rounded-md border p-2"
          >
            <span className="font-mono text-xs w-6 text-muted-foreground text-right">
              #{idx + 1}
            </span>
            {r.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={r.iconUrl}
                alt=""
                className="h-8 w-8 rounded"
                loading="lazy"
              />
            ) : (
              <div className="h-8 w-8 rounded bg-muted" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{r.appName}</span>
                <Badge variant="outline" className="text-xs">
                  {r.store === "playstore" ? "Play" : "iOS"}
                </Badge>
                {r.isNewEntry && (
                  <Badge className="text-xs">NEW</Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {r.isNewEntry
                  ? `debuted at #${r.newRank}`
                  : `#${r.oldRank} → #${r.newRank} (+${r.rankDelta})`}
                {" · "}
                {r.countriesRising}/{r.countriesTotal} countries
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-mono text-sm font-semibold">
                {Math.round(r.momentum)}
              </div>
              <div className="text-[10px] text-muted-foreground">momentum</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
