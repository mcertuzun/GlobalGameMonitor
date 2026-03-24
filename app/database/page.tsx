"use client";

import { useEffect, useState, useCallback } from "react";
import { GameDatabaseTable, type GameMetadataEntry } from "@/components/tables/game-database-table";

export default function DatabasePage() {
  const [games, setGames] = useState<GameMetadataEntry[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [genreFilter, setGenreFilter] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchGames = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "100");
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (genreFilter) params.set("genre", genreFilter);

      const res = await fetch(`/api/game-metadata?${params.toString()}`);
      const json = await res.json();
      setGames(Array.isArray(json.data) ? json.data : []);
      if (Array.isArray(json.genres)) {
        setGenres(json.genres);
      }
    } catch {
      // Network error — keep current state
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, genreFilter]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="font-heading text-xl font-semibold">Game Database</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse and search the game metadata catalog. Click a row to see full details.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor="game-search" className="text-sm text-muted-foreground">
            Search:
          </label>
          <input
            id="game-search"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name..."
            className="w-64 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="genre-filter" className="text-sm text-muted-foreground">
            Genre:
          </label>
          <select
            id="genre-filter"
            value={genreFilter}
            onChange={(e) => setGenreFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm"
          >
            <option value="">All Genres</option>
            {genres.map((genre) => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </select>
        </div>

        <span className="text-sm text-muted-foreground">
          {loading ? "Loading..." : `${games.length} game${games.length !== 1 ? "s" : ""} found`}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-muted-foreground">Loading game database...</p>
      ) : (
        <GameDatabaseTable data={games} />
      )}
    </div>
  );
}
