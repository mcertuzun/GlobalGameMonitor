"use client";

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

export interface TrendSignalEntry {
  source: string;
  name: string;
  signalType: string;
  value: number;
  date: string;
}

interface TrendSignalsTableProps {
  data: TrendSignalEntry[];
}

const sourceColors: Record<string, string> = {
  "itchio-jams": "bg-green-600 text-white",
  "trending-now": "bg-blue-600 text-white",
  youtube: "bg-red-600 text-white",
  "google-trends": "bg-orange-500 text-white",
};

const sourceLabels: Record<string, string> = {
  "itchio-jams": "itch.io Jams",
  "trending-now": "TrendingNow",
  youtube: "YouTube",
  "google-trends": "Google Trends",
};

export function TrendSignalsTable({ data }: TrendSignalsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Source</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Signal Type</TableHead>
          <TableHead>Value</TableHead>
          <TableHead>Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground">
              No trend signals found. Data will appear once scrapers collect itch.io, Steam, YouTube, or Google Trends data.
            </TableCell>
          </TableRow>
        ) : (
          data.map((entry, idx) => (
            <TableRow key={`${entry.source}-${entry.name}-${entry.date}-${idx}`}>
              <TableCell>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${sourceColors[entry.source] ?? "bg-gray-500 text-white"}`}
                >
                  {sourceLabels[entry.source] ?? entry.source}
                </span>
              </TableCell>
              <TableCell className="font-medium max-w-64 truncate">
                {entry.name}
              </TableCell>
              <TableCell>
                <Badge variant="outline">{entry.signalType}</Badge>
              </TableCell>
              <TableCell>
                {entry.value !== null && entry.value !== undefined
                  ? entry.value.toFixed(1)
                  : "-"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(entry.date)}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
