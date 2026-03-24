"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScraperStatus } from "@/components/scraper/scraper-status";
import { formatNumber, formatDate } from "@/lib/utils/formatting";

interface Snapshot {
  id: number;
  appId: number;
  source: string;
  date: string;
  rating: number | null;
  ratingCount: number | null;
  downloadsEstimate: number | null;
}

interface DashboardSummary {
  totalApps: number;
  ownApps: number;
  latestSnapshots: Snapshot[];
  latestAds: { id: number }[];
  communitySignalCount: number;
  latestCommunitySignals: {
    id: number;
    source: string;
    title: string | null;
    date: string;
    appName: string;
  }[];
  scraperStatus: {
    id: number;
    scraperName: string;
    startedAt: string;
    finishedAt: string | null;
    status: string;
    recordsFetched: number | null;
    errorMessage: string | null;
  }[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/summary")
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <p className="text-destructive">Failed to load dashboard data.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      <h2 className="font-heading text-xl font-semibold">Dashboard</h2>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Games</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.totalApps}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Own Games</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.ownApps}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ad Creatives</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.latestAds.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Community Signals</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.communitySignalCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Scraper Status */}
      <section>
        <h3 className="mb-3 font-heading text-lg font-medium">Scraper Status</h3>
        <ScraperStatus runs={data.scraperStatus} />
      </section>

      {/* Latest Market Data */}
      <section>
        <h3 className="mb-3 font-heading text-lg font-medium">Latest Market Data</h3>
        {data.latestSnapshots.length === 0 ? (
          <p className="text-sm text-muted-foreground">No market data yet.</p>
        ) : (
          <div className="space-y-2">
            {data.latestSnapshots.map((snap) => (
              <div
                key={snap.id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm">{snap.source}</span>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(snap.date)}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {snap.rating !== null && (
                    <span>Rating: {snap.rating.toFixed(1)}</span>
                  )}
                  {snap.downloadsEstimate !== null && (
                    <span>Downloads: {formatNumber(snap.downloadsEstimate)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
