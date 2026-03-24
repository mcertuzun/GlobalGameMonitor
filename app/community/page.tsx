"use client";

import { useEffect, useState } from "react";
import { CommunityTable } from "@/components/tables/community-table";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/formatting";

interface CommunityEntry {
  id: number;
  appName: string;
  source: string;
  title: string | null;
  url: string | null;
  contentSummary: string | null;
  engagementScore: number | null;
  date: string;
}

interface TrendEntry {
  id: number;
  appName: string;
  keyword: string;
  region: string | null;
  interestScore: number | null;
  date: string;
}

const SOURCE_OPTIONS = ["all", "reddit", "twitch", "news"] as const;

export default function CommunityPage() {
  const [signals, setSignals] = useState<CommunityEntry[]>([]);
  const [trends, setTrends] = useState<TrendEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  useEffect(() => {
    const sourceParam = sourceFilter === "all" ? "" : `?source=${sourceFilter}`;
    const signalsUrl = `/api/community${sourceParam}`;

    setLoading(true);

    Promise.all([
      fetch(signalsUrl).then((r) => r.json()),
      fetch("/api/trends").then((r) => r.json()),
    ])
      .then(([signalsJson, trendsJson]) => {
        setSignals(Array.isArray(signalsJson) ? signalsJson : []);
        setTrends(Array.isArray(trendsJson) ? trendsJson : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sourceFilter]);

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold">Community Signals</h2>

        <div className="flex items-center gap-2">
          <label htmlFor="source-filter" className="text-sm text-muted-foreground">
            Source:
          </label>
          <select
            id="source-filter"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm"
          >
            {SOURCE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt === "all" ? "All Sources" : opt.charAt(0).toUpperCase() + opt.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading community data...</p>
      ) : (
        <CommunityTable data={signals} />
      )}

      {/* Trends Section */}
      <section>
        <h3 className="mb-3 font-heading text-lg font-medium">Google Trends</h3>

        {loading ? (
          <p className="text-muted-foreground">Loading trends...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Keyword</TableHead>
                <TableHead>App</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Interest Score</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trends.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No trends data found. Data will appear once the Google Trends scraper runs.
                  </TableCell>
                </TableRow>
              ) : (
                trends.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Badge variant="outline">{t.keyword}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{t.appName}</TableCell>
                    <TableCell>{t.region ?? "Global"}</TableCell>
                    <TableCell>
                      {t.interestScore !== null ? t.interestScore.toFixed(0) : "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(t.date)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
