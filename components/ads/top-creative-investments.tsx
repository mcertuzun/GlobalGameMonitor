"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface ScoredCreative {
  id: number;
  appId: number;
  appName: string;
  platform: string;
  creativeType: string | null;
  creativeUrl: string | null;
  headline: string | null;
  adCopy: string | null;
  firstSeen: string | null;
  lastSeen: string | null;
  isActive: boolean | null;
  countries: string[];
  platforms: string[];
  daysActive: number;
  countriesCount: number;
  platformsCount: number;
  variantCount: number;
  investmentScore: number;
}

interface InvestmentResponse {
  total: number;
  top: ScoredCreative[];
  shareOfVoice: { id: number; headline: string | null; share: number }[];
  generatedAt: string;
}

function compactDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso.slice(0, 10);
    return d.toISOString().slice(0, 10);
  } catch {
    return iso.slice(0, 10);
  }
}

export function TopCreativeInvestments() {
  const [data, setData] = useState<InvestmentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ads/investment-score?limit=10")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: InvestmentResponse) => setData(json))
      .catch((err) => setError(err.message ?? "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Creative Investments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Creative Investments</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Couldn&apos;t compute scores{error ? `: ${error}` : ""}.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (data.top.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Creative Investments</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No creatives scored yet. Configure META_AD_LIBRARY_TOKEN in Settings
            and mark at least one app as &quot;own game&quot; to start collecting
            data.
          </p>
        </CardContent>
      </Card>
    );
  }

  const maxScore = data.top[0]?.investmentScore || 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Top Creative Investments</span>
          <span className="text-xs font-normal text-muted-foreground">
            estimated — {data.total} creatives scored
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.top.map((c, idx) => {
          const share =
            data.shareOfVoice.find((s) => s.id === c.id)?.share ?? 0;
          const barWidth = Math.max(
            4,
            Math.round((c.investmentScore / maxScore) * 100)
          );
          return (
            <div
              key={c.id}
              className="rounded-md border p-3 space-y-2"
              data-creative-id={c.id}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      #{idx + 1}
                    </span>
                    <span className="font-medium truncate">{c.appName}</span>
                    <Badge variant="outline" className="text-xs">
                      {c.platform}
                    </Badge>
                    {c.creativeType && (
                      <Badge variant="secondary" className="text-xs">
                        {c.creativeType}
                      </Badge>
                    )}
                    <Badge
                      variant={c.isActive ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {c.isActive ? "active" : "paused"}
                    </Badge>
                  </div>
                  <p className="text-sm mt-1 truncate">
                    {c.headline ?? c.adCopy ?? "(no copy)"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-sm font-semibold">
                    {c.investmentScore.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {share}% share
                  </div>
                </div>
              </div>

              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${barWidth}%` }}
                />
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>{c.daysActive}d live</span>
                <span>{c.countriesCount} countries</span>
                <span>{c.platformsCount} surfaces</span>
                {c.variantCount > 1 && <span>{c.variantCount} variants</span>}
                <span>first seen {compactDate(c.firstSeen)}</span>
              </div>
            </div>
          );
        })}

        <p className="text-[11px] text-muted-foreground pt-1">
          Scores are a longevity × breadth × variant-count proxy for spend — not
          a direct dollar estimate. Meta Ad Library only exposes impression
          buckets for political / EU-disclosed ads.
        </p>
      </CardContent>
    </Card>
  );
}
