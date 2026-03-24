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

interface AdsTableProps {
  data: AdEntry[];
}

export function AdsTable({ data }: AdsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Game</TableHead>
          <TableHead>Platform</TableHead>
          <TableHead>Headline</TableHead>
          <TableHead>Ad Copy</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>First Seen</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-muted-foreground">
              No ad creatives found.
            </TableCell>
          </TableRow>
        ) : (
          data.map((ad) => (
            <TableRow key={ad.id}>
              <TableCell className="font-medium">{ad.appName}</TableCell>
              <TableCell>
                <Badge variant="outline">{ad.platform}</Badge>
              </TableCell>
              <TableCell className="max-w-48 truncate">
                {ad.headline ?? "-"}
              </TableCell>
              <TableCell className="max-w-64 truncate">
                {ad.adCopy ?? "-"}
              </TableCell>
              <TableCell>{ad.creativeType ?? "-"}</TableCell>
              <TableCell>
                <Badge variant={ad.isActive ? "default" : "secondary"}>
                  {ad.isActive ? "active" : "inactive"}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {ad.firstSeen ? formatDate(ad.firstSeen) : "-"}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
