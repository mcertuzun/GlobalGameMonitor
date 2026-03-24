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

interface CommunityTableProps {
  data: CommunityEntry[];
}

const sourceBadgeVariant: Record<string, "default" | "secondary" | "outline"> = {
  reddit: "default",
  twitch: "secondary",
  news: "outline",
};

export function CommunityTable({ data }: CommunityTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Source</TableHead>
          <TableHead>Title</TableHead>
          <TableHead>App</TableHead>
          <TableHead>Summary</TableHead>
          <TableHead>Engagement</TableHead>
          <TableHead>Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground">
              No community signals found. Data will appear once scrapers collect Reddit, Twitch, or News content.
            </TableCell>
          </TableRow>
        ) : (
          data.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell>
                <Badge variant={sourceBadgeVariant[entry.source] ?? "outline"}>
                  {entry.source}
                </Badge>
              </TableCell>
              <TableCell className="max-w-56 truncate">
                {entry.url ? (
                  <a
                    href={entry.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2 hover:text-primary/80"
                  >
                    {entry.title ?? "Untitled"}
                  </a>
                ) : (
                  entry.title ?? "-"
                )}
              </TableCell>
              <TableCell className="font-medium">{entry.appName}</TableCell>
              <TableCell className="max-w-64 truncate">
                {entry.contentSummary ?? "-"}
              </TableCell>
              <TableCell>
                {entry.engagementScore !== null
                  ? entry.engagementScore.toFixed(1)
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
