"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CreativeCard,
  type CreativeCardData,
} from "@/components/creatives/creative-card";

interface AppRow {
  id: number;
  name: string;
  store: string;
  storeId: string;
  iconUrl: string | null;
  developer: string | null;
  category: string | null;
  watchlistReason: string | null;
}

interface AppBucket {
  app: AppRow;
  creativeCount: number;
  totalInvestmentScore: number;
  topCreatives: CreativeCardData[];
}

interface GalleryResponse {
  generatedAt: string;
  count: number;
  apps: AppBucket[];
}

export default function CreativesGalleryPage() {
  const [data, setData] = useState<GalleryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("all");
  const [creativeType, setCreativeType] = useState("all");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (reason !== "all") params.set("reason", reason);
    if (creativeType !== "all") params.set("creativeType", creativeType);
    params.set("perApp", "3");

    setLoading(true);
    fetch(`/api/creatives?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: GalleryResponse) => setData(json))
      .catch((err) => setError(err.message ?? "Failed to load"))
      .finally(() => setLoading(false));
  }, [reason, creativeType]);

  async function runSync() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/watchlist/sync", { method: "POST" });
      const json = await res.json();
      setSyncMessage(
        `Sync done — added ${json.added}, kept ${json.kept}, removed ${json.removed}.`
      );
      // Re-fetch gallery
      const params = new URLSearchParams();
      if (reason !== "all") params.set("reason", reason);
      if (creativeType !== "all") params.set("creativeType", creativeType);
      const updated = await fetch(`/api/creatives?${params.toString()}`);
      setData(await updated.json());
    } catch (err) {
      setSyncMessage(
        err instanceof Error ? `Sync failed: ${err.message}` : "Sync failed"
      );
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-heading text-xl font-semibold">Creative Gallery</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Top marketing creatives for watchlist games — ranked by estimated
            investment (longevity × country breadth × variant count).
          </p>
        </div>
        <Button onClick={runSync} disabled={syncing} variant="outline">
          {syncing ? "Syncing…" : "Sync watchlist"}
        </Button>
      </div>

      {syncMessage && (
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs">
          {syncMessage}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Select value={reason} onValueChange={(v) => v && setReason(v)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Watchlist reason" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All games</SelectItem>
            <SelectItem value="top-grossing">Top grossing</SelectItem>
            <SelectItem value="top-free">Top free</SelectItem>
            <SelectItem value="own-game">Own games</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={creativeType}
          onValueChange={(v) => v && setCreativeType(v)}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="video">Video</SelectItem>
            <SelectItem value="image">Image</SelectItem>
            <SelectItem value="playable">Playable</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-muted-foreground">Failed: {error}</p>
      ) : !data || data.apps.length === 0 ? (
        <div className="rounded-md border p-8 text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            No tracked games yet. Click &quot;Sync watchlist&quot; to auto-populate
            from the top grossing and top free charts, or flag games manually
            with `isOwnGame = true`.
          </p>
          <p className="text-xs text-muted-foreground">
            Remember to configure META_AD_LIBRARY_TOKEN in Settings first.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {data.apps.map(({ app, creativeCount, totalInvestmentScore, topCreatives }) => (
            <section key={app.id} className="space-y-3">
              <div className="flex items-center gap-3">
                {app.iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={app.iconUrl}
                    alt=""
                    className="h-10 w-10 rounded"
                  />
                ) : (
                  <div className="h-10 w-10 rounded bg-muted" />
                )}
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/creatives/${app.id}`}
                    className="font-medium hover:underline"
                  >
                    {app.name}
                  </Link>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <span>{app.developer ?? "unknown"}</span>
                    <span>·</span>
                    <span>{creativeCount} creatives</span>
                    <span>·</span>
                    <span>total score {totalInvestmentScore}</span>
                    {app.watchlistReason && (
                      <>
                        <span>·</span>
                        <Badge variant="outline" className="text-[10px]">
                          {app.watchlistReason}
                        </Badge>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {topCreatives.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No creatives captured yet — run the meta-ad-library scraper.
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {topCreatives.map((c) => (
                    <CreativeCard key={c.id} creative={c} />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
