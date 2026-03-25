"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  { name: "reddit", label: "Reddit RSS" },
  { name: "twitch-tracker", label: "Twitch Tracker" },
  { name: "google-trends", label: "Google Trends" },
  { name: "news-rss", label: "News RSS" },
  { name: "rawg", label: "RAWG Game Database" },
  { name: "itchio-jams", label: "itch.io Game Jams" },
  { name: "trending-now", label: "TrendingNow.games" },
  { name: "youtube", label: "YouTube Data API" },
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

interface ScheduleInfo {
  category: string;
  intervalHours: number;
  intervalLabel: string;
  scrapers: string[];
  nextRun: string | null;
}

interface SchedulerState {
  enabled: boolean;
  schedules: ScheduleInfo[];
}

interface ApiKeyInfo {
  id: string;
  label: string;
  description: string;
  url: string;
  isSet: boolean;
  maskedValue: string | null;
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
  const [scheduler, setScheduler] = useState<SchedulerState>({
    enabled: false,
    schedules: [],
  });
  const [schedulerToggling, setSchedulerToggling] = useState(false);

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(true);
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, string>>({});
  const [apiKeySaving, setApiKeySaving] = useState<Set<string>>(new Set());
  const [apiKeyFeedback, setApiKeyFeedback] = useState<Record<string, { type: "success" | "error"; message: string }>>({});

  const fetchStatus = useCallback(() => {
    fetch("/api/scraper/status")
      .then((res) => res.json())
      .then((json) => setRuns(Array.isArray(json) ? json : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fetchScheduler = useCallback(() => {
    fetch("/api/scheduler")
      .then((res) => res.json())
      .then((json) => setScheduler(json))
      .catch(() => {});
  }, []);

  const fetchDbStats = useCallback(() => {
    setDbLoading(true);
    fetch("/api/db/stats")
      .then((res) => res.json())
      .then((json) => setDbStats(json))
      .catch(() => {})
      .finally(() => setDbLoading(false));
  }, []);

  const fetchApiKeys = useCallback(() => {
    setApiKeysLoading(true);
    fetch("/api/settings/api-keys")
      .then((res) => res.json())
      .then((json) => {
        if (Array.isArray(json)) {
          setApiKeys(json);
        }
      })
      .catch(() => {})
      .finally(() => setApiKeysLoading(false));
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchDbStats();
    fetchScheduler();
    fetchApiKeys();
  }, [fetchStatus, fetchDbStats, fetchScheduler, fetchApiKeys]);

  async function handleToggleScheduler() {
    setSchedulerToggling(true);
    try {
      const res = await fetch("/api/scheduler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !scheduler.enabled }),
      });
      const json = await res.json();
      setScheduler(json);
    } catch {
      // ignore
    } finally {
      setSchedulerToggling(false);
    }
  }

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

  function clearFeedback(keyId: string) {
    setTimeout(() => {
      setApiKeyFeedback((prev) => {
        const next = { ...prev };
        delete next[keyId];
        return next;
      });
    }, 3000);
  }

  async function handleSaveApiKey(keyId: string) {
    const value = apiKeyInputs[keyId]?.trim();
    if (!value) return;

    setApiKeySaving((prev) => new Set(prev).add(keyId));
    setApiKeyFeedback((prev) => {
      const next = { ...prev };
      delete next[keyId];
      return next;
    });

    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyId, value }),
      });
      const json = await res.json();

      if (res.ok && Array.isArray(json)) {
        setApiKeys(json);
        setApiKeyInputs((prev) => ({ ...prev, [keyId]: "" }));
        setApiKeyFeedback((prev) => ({
          ...prev,
          [keyId]: { type: "success", message: "Saved" },
        }));
      } else {
        setApiKeyFeedback((prev) => ({
          ...prev,
          [keyId]: { type: "error", message: json.error || "Failed to save" },
        }));
      }
    } catch {
      setApiKeyFeedback((prev) => ({
        ...prev,
        [keyId]: { type: "error", message: "Network error" },
      }));
    } finally {
      setApiKeySaving((prev) => {
        const next = new Set(prev);
        next.delete(keyId);
        return next;
      });
      clearFeedback(keyId);
    }
  }

  async function handleClearApiKey(keyId: string) {
    setApiKeySaving((prev) => new Set(prev).add(keyId));
    setApiKeyFeedback((prev) => {
      const next = { ...prev };
      delete next[keyId];
      return next;
    });

    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyId }),
      });
      const json = await res.json();

      if (res.ok && Array.isArray(json)) {
        setApiKeys(json);
        setApiKeyFeedback((prev) => ({
          ...prev,
          [keyId]: { type: "success", message: "Cleared" },
        }));
      } else {
        setApiKeyFeedback((prev) => ({
          ...prev,
          [keyId]: { type: "error", message: json.error || "Failed to clear" },
        }));
      }
    } catch {
      setApiKeyFeedback((prev) => ({
        ...prev,
        [keyId]: { type: "error", message: "Network error" },
      }));
    } finally {
      setApiKeySaving((prev) => {
        const next = new Set(prev);
        next.delete(keyId);
        return next;
      });
      clearFeedback(keyId);
    }
  }

  return (
    <div className="space-y-8 p-6">
      <h2 className="font-heading text-xl font-semibold">Settings</h2>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
        </CardHeader>
        <CardContent>
          {apiKeysLoading ? (
            <p className="text-muted-foreground">Loading API keys...</p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Configure API keys for scrapers. Keys are stored in the database and take priority over environment variables.
              </p>
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className="rounded-lg border border-border px-4 py-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{key.label}</p>
                        <Badge variant={key.isSet ? "default" : "secondary"}>
                          {key.isSet ? "Set" : "Not Set"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {key.description}
                      </p>
                      {key.isSet && key.maskedValue && (
                        <p className="text-xs font-mono text-muted-foreground mt-1">
                          {key.maskedValue}
                        </p>
                      )}
                    </div>
                    <a
                      href={key.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0"
                    >
                      <Button variant="outline" size="sm">
                        Get Key
                      </Button>
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="password"
                      placeholder={key.isSet ? "Enter new key to update..." : "Enter API key..."}
                      value={apiKeyInputs[key.id] || ""}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setApiKeyInputs((prev) => ({
                          ...prev,
                          [key.id]: e.target.value,
                        }))
                      }
                      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                        if (e.key === "Enter") handleSaveApiKey(key.id);
                      }}
                      className="flex-1"
                    />
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleSaveApiKey(key.id)}
                      disabled={
                        apiKeySaving.has(key.id) ||
                        !apiKeyInputs[key.id]?.trim()
                      }
                    >
                      {apiKeySaving.has(key.id) ? "Saving..." : "Save"}
                    </Button>
                    {key.isSet && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleClearApiKey(key.id)}
                        disabled={apiKeySaving.has(key.id)}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  {apiKeyFeedback[key.id] && (
                    <p
                      className={`text-xs ${
                        apiKeyFeedback[key.id].type === "success"
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {apiKeyFeedback[key.id].message}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Auto Refresh */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Auto Refresh</CardTitle>
            <button
              type="button"
              onClick={handleToggleScheduler}
              disabled={schedulerToggling}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                scheduler.enabled ? "bg-primary" : "bg-muted-foreground/30"
              } ${schedulerToggling ? "opacity-50" : ""}`}
              role="switch"
              aria-checked={scheduler.enabled}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  scheduler.enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {scheduler.enabled ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Scrapers are running automatically on the schedules below.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-2 pr-4 font-medium">Category</th>
                      <th className="pb-2 pr-4 font-medium">Interval</th>
                      <th className="pb-2 pr-4 font-medium">Scrapers</th>
                      <th className="pb-2 font-medium">Next Run (est.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduler.schedules.map((s) => (
                      <tr
                        key={s.category}
                        className="border-b border-border/50"
                      >
                        <td className="py-2 pr-4 font-medium">
                          {s.category}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {s.intervalLabel}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground font-mono text-xs">
                          {s.scrapers.join(", ")}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {s.nextRun
                            ? new Date(s.nextRun).toLocaleString()
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Auto refresh is disabled. Toggle the switch above to enable
              automatic periodic scraping.
            </p>
          )}
        </CardContent>
      </Card>

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
