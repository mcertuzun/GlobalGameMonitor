"use client";

import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/utils/formatting";

interface ScraperRun {
  id: number;
  scraperName: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  recordsFetched: number | null;
  errorMessage: string | null;
}

interface ScraperStatusProps {
  runs: ScraperRun[];
}

function statusVariant(status: string) {
  switch (status) {
    case "success":
      return "default" as const;
    case "running":
      return "secondary" as const;
    case "error":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

export function ScraperStatus({ runs }: ScraperStatusProps) {
  // Group by scraper name and pick latest run per scraper
  const latestByName = new Map<string, ScraperRun>();
  for (const run of runs) {
    const existing = latestByName.get(run.scraperName);
    if (!existing || run.startedAt > existing.startedAt) {
      latestByName.set(run.scraperName, run);
    }
  }

  const entries = Array.from(latestByName.values()).sort((a, b) =>
    a.scraperName.localeCompare(b.scraperName)
  );

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No scraper runs yet.</p>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((run) => (
        <div
          key={run.id}
          className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
        >
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm">{run.scraperName}</span>
            <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {run.recordsFetched !== null && (
              <span>{run.recordsFetched} records</span>
            )}
            <span>{timeAgo(run.startedAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
