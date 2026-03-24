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

export default function SettingsPage() {
  const [runs, setRuns] = useState<ScraperRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningScrapers, setRunningScrapers] = useState<Set<string>>(
    new Set()
  );
  const [runningAll, setRunningAll] = useState(false);

  const fetchStatus = useCallback(() => {
    fetch("/api/scraper/status")
      .then((res) => res.json())
      .then((json) => setRuns(Array.isArray(json) ? json : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

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
