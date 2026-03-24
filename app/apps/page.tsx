"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { AddAppForm } from "@/components/apps/add-app-form";
import { AppCard } from "@/components/apps/app-card";

interface App {
  id: number;
  store: string;
  storeId: string;
  name: string;
  developer: string | null;
  category: string | null;
  iconUrl: string | null;
  isOwnGame: boolean | null;
}

export default function AppsPage() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchApps = useCallback(() => {
    setLoading(true);
    fetch("/api/apps")
      .then((res) => res.json())
      .then((json) => setApps(json.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold">Games</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? "Cancel" : "Add Game"}
        </Button>
      </div>

      {showForm && (
        <AddAppForm
          onAdded={() => {
            setShowForm(false);
            fetchApps();
          }}
        />
      )}

      {loading ? (
        <p className="text-muted-foreground">Loading games...</p>
      ) : apps.length === 0 ? (
        <p className="text-muted-foreground">
          No games tracked yet. Add one to get started.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <AppCard key={app.id} app={app} />
          ))}
        </div>
      )}
    </div>
  );
}
