"use client";

import { useState } from "react";
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

export interface GameMetadataEntry {
  id: number;
  source: string;
  sourceId: string;
  name: string;
  genres: string | null;
  tags: string | null;
  platforms: string | null;
  rating: number | null;
  ratingCount: number | null;
  releaseDate: string | null;
  developer: string | null;
  publisher: string | null;
  description: string | null;
  imageUrl: string | null;
  metacriticScore: number | null;
  playtime: number | null;
}

interface GameDatabaseTableProps {
  data: GameMetadataEntry[];
}

function formatPlaytime(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return "-";
  const hours = Math.floor(minutes / 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h`;
}

function StarRating({ rating }: { rating: number | null }) {
  if (rating === null || rating === undefined) return <span>-</span>;
  const stars = Math.round(rating * 2) / 2; // round to nearest 0.5
  const fullStars = Math.floor(stars);
  const halfStar = stars % 1 >= 0.5;
  return (
    <span className="flex items-center gap-0.5" title={`${rating.toFixed(2)}`}>
      {Array.from({ length: fullStars }).map((_, i) => (
        <span key={i} className="text-yellow-500">&#9733;</span>
      ))}
      {halfStar && <span className="text-yellow-500">&#189;</span>}
      <span className="ml-1 text-xs text-muted-foreground">{rating.toFixed(1)}</span>
    </span>
  );
}

export function GameDatabaseTable({ data }: GameDatabaseTableProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-14">Image</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Genres</TableHead>
          <TableHead>Tags</TableHead>
          <TableHead>Rating</TableHead>
          <TableHead>Metacritic</TableHead>
          <TableHead>Playtime</TableHead>
          <TableHead>Release Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="text-center text-muted-foreground">
              No games found. Data will appear once the RAWG scraper runs, or try adjusting your filters.
            </TableCell>
          </TableRow>
        ) : (
          data.map((game) => {
            const isExpanded = expandedId === game.id;
            const genresList = game.genres?.split(",").map((g) => g.trim()).filter(Boolean) ?? [];
            const tagsList = game.tags?.split(",").map((t) => t.trim()).filter(Boolean) ?? [];
            const platformsList = game.platforms?.split(",").map((p) => p.trim()).filter(Boolean) ?? [];

            return (
              <TableRow
                key={game.id}
                className="cursor-pointer"
                onClick={() => toggleExpand(game.id)}
              >
                <TableCell>
                  {game.imageUrl ? (
                    <img
                      src={game.imageUrl}
                      alt={game.name}
                      className="h-12 w-12 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded bg-muted text-muted-foreground text-xs">
                      N/A
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{game.name}</div>
                    {isExpanded && (
                      <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                        {game.description && (
                          <p className="max-w-lg whitespace-normal">{game.description.slice(0, 300)}{game.description.length > 300 ? "..." : ""}</p>
                        )}
                        {game.developer && <p><span className="font-medium text-foreground">Developer:</span> {game.developer}</p>}
                        {game.publisher && <p><span className="font-medium text-foreground">Publisher:</span> {game.publisher}</p>}
                        {platformsList.length > 0 && (
                          <p><span className="font-medium text-foreground">Platforms:</span> {platformsList.join(", ")}</p>
                        )}
                        {tagsList.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            <span className="font-medium text-foreground">All Tags:</span>
                            {tagsList.map((tag) => (
                              <Badge key={tag} variant="outline">{tag}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {genresList.slice(0, 3).map((genre) => (
                      <Badge key={genre} variant="secondary">{genre}</Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {tagsList.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="outline">{tag}</Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <StarRating rating={game.rating} />
                </TableCell>
                <TableCell>
                  {game.metacriticScore !== null ? (
                    <span
                      className={`inline-flex items-center justify-center rounded px-1.5 py-0.5 text-xs font-bold ${
                        game.metacriticScore >= 75
                          ? "bg-green-600 text-white"
                          : game.metacriticScore >= 50
                            ? "bg-yellow-500 text-black"
                            : "bg-red-600 text-white"
                      }`}
                    >
                      {game.metacriticScore}
                    </span>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>{formatPlaytime(game.playtime)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {game.releaseDate ? formatDate(game.releaseDate) : "-"}
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
