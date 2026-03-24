"use client";

import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils/formatting";

interface ChartEntry {
  id: number;
  rank: number;
  appName: string;
  developer: string | null;
  iconUrl: string | null;
  date: string;
}

interface ChartsTableProps {
  data: ChartEntry[];
}

export function ChartsTable({ data }: ChartsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">#</TableHead>
          <TableHead>Game</TableHead>
          <TableHead>Developer</TableHead>
          <TableHead>Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-muted-foreground">
              No chart data available.
            </TableCell>
          </TableRow>
        ) : (
          data.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="font-medium">{entry.rank}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {entry.iconUrl ? (
                    <img
                      src={entry.iconUrl}
                      alt={entry.appName}
                      className="size-8 rounded object-cover"
                    />
                  ) : (
                    <div className="flex size-8 items-center justify-center rounded bg-muted text-sm">
                      {"?"}
                    </div>
                  )}
                  <span className="truncate">{entry.appName}</span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {entry.developer ?? "-"}
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
