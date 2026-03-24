"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChartsTable } from "@/components/tables/charts-table";

interface ChartEntry {
  id: number;
  rank: number;
  appName: string;
  developer: string | null;
  iconUrl: string | null;
  date: string;
}

export default function ChartsPage() {
  const [store, setStore] = useState("appstore");
  const [chartType, setChartType] = useState("free");
  const [data, setData] = useState<ChartEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCharts = useCallback(() => {
    setLoading(true);
    fetch(`/api/charts?store=${store}&chartType=${chartType}`)
      .then((res) => res.json())
      .then((json) => setData(Array.isArray(json) ? json : []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [store, chartType]);

  useEffect(() => {
    fetchCharts();
  }, [fetchCharts]);

  return (
    <div className="space-y-6 p-6">
      <h2 className="font-heading text-xl font-semibold">Top Charts</h2>

      <div className="flex items-center gap-4">
        <Select value={store} onValueChange={(v) => v && setStore(v)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="appstore">App Store</SelectItem>
            <SelectItem value="playstore">Play Store</SelectItem>
          </SelectContent>
        </Select>

        <Select value={chartType} onValueChange={(v) => v && setChartType(v)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="grossing">Grossing</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading charts...</p>
      ) : (
        <ChartsTable data={data} />
      )}
    </div>
  );
}
