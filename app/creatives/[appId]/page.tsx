"use client";

import { use, useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface DetailResponse {
  app: AppRow;
  generatedAt: string;
  count: number;
  countries: string[];
  creatives: CreativeCardData[];
}

export default function CreativeDetailPage({
  params,
}: {
  params: Promise<{ appId: string }>;
}) {
  const { appId } = use(params);
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creativeType, setCreativeType] = useState<string>("all");
  const [activeOnly, setActiveOnly] = useState<string>("all");
  const [country, setCountry] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (creativeType !== "all") params.set("creativeType", creativeType);
    if (activeOnly === "active") params.set("active", "true");
    if (country !== "all") params.set("country", country);

    fetch(`/api/creatives/${appId}?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: DetailResponse) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [appId, creativeType, activeOnly, country]);

  if (loading && !data) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[9/16] w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t load creatives{error ? `: ${error}` : ""}.
        </p>
      </div>
    );
  }

  const euLikeCountries = new Set([
    "GB", "DE", "FR", "IT", "ES", "NL", "PL", "SE", "BE", "AT",
    "IE", "DK", "FI", "PT", "CZ", "GR", "HU", "RO",
  ]);
  const hasImpressionData = data.creatives.some(
    (c) => c.impressionsLower || c.impressionsUpper
  );
  const nonEuCountries = data.countries.filter(
    (c) => !euLikeCountries.has(c)
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start gap-4">
        {data.app.iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.app.iconUrl}
            alt={data.app.name}
            className="h-16 w-16 rounded-lg"
          />
        ) : (
          <div className="h-16 w-16 rounded-lg bg-muted" />
        )}
        <div className="flex-1 min-w-0">
          <h2 className="font-heading text-xl font-semibold">{data.app.name}</h2>
          <p className="text-sm text-muted-foreground">
            {data.app.developer ?? "unknown developer"} ·{" "}
            {data.app.store === "playstore" ? "Play Store" : "App Store"}
            {data.app.category ? ` · ${data.app.category}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">{data.count} creatives</Badge>
            <Badge variant="outline">{data.countries.length} countries</Badge>
            {data.app.watchlistReason && (
              <Badge variant="secondary">{data.app.watchlistReason}</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={creativeType} onValueChange={(v) => v && setCreativeType(v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="video">Video</SelectItem>
            <SelectItem value="image">Image</SelectItem>
            <SelectItem value="playable">Playable</SelectItem>
          </SelectContent>
        </Select>

        <Select value={activeOnly} onValueChange={(v) => v && setActiveOnly(v)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="active">Live only</SelectItem>
          </SelectContent>
        </Select>

        <Select value={country} onValueChange={(v) => v && setCountry(v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Country" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All countries</SelectItem>
            {data.countries.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!hasImpressionData && nonEuCountries.length > 0 && (
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Meta Ad Library only exposes impression buckets for EU/UK + political
          ads. Ranking relies on longevity × breadth × variant count for the
          other {nonEuCountries.length} market(s).
        </div>
      )}

      {data.creatives.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No creatives match these filters.
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {data.creatives.map((c) => (
            <CreativeCard key={c.id} creative={c} />
          ))}
        </div>
      )}
    </div>
  );
}
