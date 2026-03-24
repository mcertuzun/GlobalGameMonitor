"use client";

import { useEffect, useState } from "react";
import { AdsTable } from "@/components/tables/ads-table";

interface AdEntry {
  id: number;
  appName: string;
  platform: string;
  headline: string | null;
  adCopy: string | null;
  creativeType: string | null;
  isActive: boolean | null;
  firstSeen: string | null;
}

export default function AdsPage() {
  const [ads, setAds] = useState<AdEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/ads")
      .then((res) => res.json())
      .then((json) => setAds(Array.isArray(json) ? json : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 p-6">
      <h2 className="font-heading text-xl font-semibold">Ad Creatives</h2>

      {loading ? (
        <p className="text-muted-foreground">Loading ads...</p>
      ) : (
        <AdsTable data={ads} />
      )}
    </div>
  );
}
