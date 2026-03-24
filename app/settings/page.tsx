"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScraperStatus } from "@/components/scraper/scraper-status";

const SCRAPERS = [
  { name: "apple-top-charts", label: "Apple Top Charts" },
  { name: "apple-app-detail", label: "Apple App Detail" },
  { name: "google-play-detail", label: "Google Play Detail" },
  { name: "google-play-top-charts", label: "Google Play Top Charts" },
  { name: "meta-ad-library", label: "Meta Ad Library" },
  { name: "google-ads-transparency", label: "Google Ads Transparency" },
  { name: "tiktok-creative", label: "TikTok Creative Center" },
  { name: "appbrain-sdk", label: "AppBrain SDK Intelligence" },
  { name: "steamspy", label: "SteamSpy" },
  { name: "steam-api", label: "Steam Store API" },
];

interface ScraperRun {
  id: number;
  scraperName: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  recordsFetched: number | null;
  errorMessage: string | null;
}

interface DbStats {
  apps: number;
  snapshots: number;
  charts: number;
  ads: number;
  sdkUsage: number;
  signals: number;
  scraperRuns: number;
  dbSizeMB: number;
}

interface CleanupResult {
  status: string;
  retentionDays: number;
  deletedSnapshots: number;
  deletedCharts: number;
  deletedSignals: number;
  deletedRuns: number;
}

export default function SettingsPage() {
  const [runs, setRuns] = useState<ScraperRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningScrapers, setRunningScrapers] = useState<Set<string>>(
    new Set()
  );
  const [runningAll, setRunningAll] = useState(false);
  const [dbStats, setDbStats] = useState<DbStats | null>(null);
  const [dbLoading, setDbLoading] = useState(true);
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);

  const fetchStatus = useCallback(() => {
    fetch("/api/scraper/status")
      .then((res) => res.json())
      .then((json) => setRuns(Array.isArray(json) ? json : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fetchDbStats = useCallback(() => {
    setDbLoading(true);
    fetch("/api/db/stats")
      .then((res) => res.json())
      .then((json) => setDbStats(json))
      .catch(() => {})
      .finally(() => setDbLoading(false));
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchDbStats();
  }, [fetchStatus, fetchDbStats]);

  async function handleRunScraper(name: string) {
    setRunningScrapers((prev) => new Set(prev).add(name));
    try {
      await fetch(`/api/scraper/run/${name}`, { method: "POST" });
      // Wait a moment, then refresh status
      setTimeout(() => {
        fetchStatus();
        setRunningScrapers((prev) => {
          const next = new Set(prev);
          next.delete(name);
          return next;
        });
      }, 1000);
    } catch {
      setRunningScrapers((prev) => {
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
    }
  }

  async function handleCleanup() {
    setCleanupRunning(true);
    setCleanupResult(null);
    try {
      const res = await fetch("/api/db/cleanup", { method: "POST" });
      const json = await res.json();
      setCleanupResult(json);
      fetchDbStats();
    } catch {
      // ignore
    } finally {
      setCleanupRunning(false);
    }
  }

  async function handleRunAll() {
    setRunningAll(true);
    try {
      await fetch("/api/scraper/run-all", { method: "POST" });
      setTimeout(() => {
        fetchStatus();
        setRunningAll(false);
      }, 1000);
    } catch {
      setRunningAll(false);
    }
  }

  return (
    <div className="space-y-8 p-6">
      <h2 className="font-heading text-xl font-semibold">Settings</h2>

      {/* Scrapers */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Scrapers</CardTitle>
            <Button
              variant="default"
              size="sm"
              onClick={handleRunAll}
              disabled={runningAll}
            >
              {runningAll ? "Running All..." : "Run All"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {SCRAPERS.map((scraper) => (
              <div
                key={scraper.name}
                className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
              >
                <div>
                  <p className="font-medium">{scraper.label}</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {scraper.name}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRunScraper(scraper.name)}
                  disabled={runningScrapers.has(scraper.name) || runningAll}
                >
                  {runningScrapers.has(scraper.name) ? "Running..." : "Run"}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Database */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Database</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCleanup}
              disabled={cleanupRunning}
            >
              {cleanupRunning ? "Cleaning..." : "Cleanup Old Data"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {dbLoading ? (
            <p className="text-muted-foreground">Loading stats...</p>
          ) : dbStats ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-border px-3 py-2">
                  <p className="text-sm text-muted-foreground">DB Size</p>
                  <p className="text-lg font-semibold">{dbStats.dbSizeMB} MB</p>
                </div>
                <div className="rounded-lg border border-border px-3 py-2">
                  <p className="text-sm text-muted-foreground">Apps</p>
                  <p className="text-lg font-semibold">{dbStats.apps}</p>
                </div>
                <div className="rounded-lg border border-border px-3 py-2">
                  <p className="text-sm text-muted-foreground">Snapshots</p>
                  <p className="text-lg font-semibold">{dbStats.snapshots}</p>
                </div>
                <div className="rounded-lg border border-border px-3 py-2">
                  <p className="text-sm text-muted-foreground">Charts</p>
                  <p className="text-lg font-semibold">{dbStats.charts}</p>
                </div>
                <div className="rounded-lg border border-border px-3 py-2">
                  <p className="text-sm text-muted-foreground">Ad Creatives</p>
                  <p className="text-lg font-semibold">{dbStats.ads}</p>
                </div>
                <div className="rounded-lg border border-border px-3 py-2">
                  <p className="text-sm text-muted-foreground">SDK Usage</p>
                  <p className="text-lg font-semibold">{dbStats.sdkUsage}</p>
                </div>
                <div className="rounded-lg border border-border px-3 py-2">
                  <p className="text-sm text-muted-foreground">Signals</p>
                  <p className="text-lg font-semibold">{dbStats.signals}</p>
                </div>
                <div className="rounded-lg border border-border px-3 py-2">
                  <p className="text-sm text-muted-foreground">Scraper Runs</p>
                  <p className="text-lg font-semibold">{dbStats.scraperRuns}</p>
                </div>
              </div>
              {cleanupResult && (
                <div className="rounded-lg border border-border bg-muted/50 px-4 py-3">
                  <p className="mb-1 text-sm font-medium">Cleanup Results (retention: {cleanupResult.retentionDays} days)</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>Deleted {cleanupResult.deletedSnapshots} snapshots</li>
                    <li>Deleted {cleanupResult.deletedCharts} chart entries</li>
                    <li>Deleted {cleanupResult.deletedSignals} signals</li>
                    <li>Deleted {cleanupResult.deletedRuns} scraper runs</li>
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">Failed to load stats.</p>
          )}
        </CardContent>
      </Card>

      {/* Recent Runs */}
      <section>
        <h3 className="mb-3 font-heading text-lg font-medium">Recent Runs</h3>
        {loading ? (
          <p className="text-muted-foreground">Loading status...</p>
        ) : (
          <ScraperStatus runs={runs} />
        )}
      </section>
    </div>
  );
}
