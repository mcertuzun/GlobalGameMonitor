"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function Header() {
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await fetch("/api/scraper/run-all", { method: "POST" });
    } catch {
      // silently fail — user can check status page
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-6">
      <h1 className="font-heading text-lg font-semibold">
        Game Market Intelligence
      </h1>
      <Button
        variant="outline"
        size="sm"
        onClick={handleRefresh}
        disabled={refreshing}
      >
        {refreshing ? "Refreshing..." : "Refresh Data"}
      </Button>
    </header>
  );
}
