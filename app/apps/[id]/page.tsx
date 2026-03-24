"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RankingChart } from "@/components/charts/ranking-chart";
import { formatNumber } from "@/lib/utils/formatting";

interface AppDetail {
  id: number;
  store: string;
  storeId: string;
  name: string;
  developer: string | null;
  category: string | null;
  iconUrl: string | null;
  isOwnGame: boolean | null;
}

interface Snapshot {
  id: number;
  date: string;
  rating: number | null;
  ratingCount: number | null;
  downloadsEstimate: number | null;
  version: string | null;
}

export default function GameDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [app, setApp] = useState<AppDetail | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    Promise.all([
      fetch(`/api/apps/${id}`).then((r) => {
        if (!r.ok) throw new Error("App not found");
        return r.json();
      }),
      fetch(`/api/apps/${id}/snapshots`).then((r) => r.json()),
    ])
      .then(([appData, snapshotData]) => {
        setApp(appData);
        setSnapshots(Array.isArray(snapshotData) ? snapshotData : []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Loading game details...</p>
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="p-6">
        <p className="text-destructive">{error ?? "App not found."}</p>
      </div>
    );
  }

  // Get latest snapshot for stat cards
  const latest = snapshots.length > 0 ? snapshots[0] : null;

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-muted text-3xl">
          {app.iconUrl ? (
            <img
              src={app.iconUrl}
              alt={app.name}
              className="size-16 rounded-xl object-cover"
            />
          ) : (
            "?"
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-xl font-semibold">{app.name}</h2>
            {app.isOwnGame && <Badge variant="secondary">Own</Badge>}
          </div>
          {app.developer && (
            <p className="text-sm text-muted-foreground">{app.developer}</p>
          )}
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline">{app.store}</Badge>
            {app.category && <Badge variant="outline">{app.category}</Badge>}
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Rating</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {latest?.rating !== null && latest?.rating !== undefined
                ? latest.rating.toFixed(1)
                : "-"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Rating Count</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {latest?.ratingCount !== null && latest?.ratingCount !== undefined
                ? formatNumber(latest.ratingCount)
                : "-"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Downloads</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {latest?.downloadsEstimate !== null &&
              latest?.downloadsEstimate !== undefined
                ? formatNumber(latest.downloadsEstimate)
                : "-"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Version</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{latest?.version ?? "-"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {snapshots.length > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Rating Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <RankingChart
                data={snapshots}
                dataKey="rating"
                label="Rating"
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Downloads Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <RankingChart
                data={snapshots}
                dataKey="downloadsEstimate"
                label="Downloads"
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
