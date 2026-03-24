"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AddAppFormProps {
  onAdded: () => void;
}

export function AddAppForm({ onAdded }: AddAppFormProps) {
  const [store, setStore] = useState("playstore");
  const [storeId, setStoreId] = useState("");
  const [name, setName] = useState("");
  const [isOwnGame, setIsOwnGame] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store, storeId, name, isOwnGame }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to add app");
        return;
      }

      setStoreId("");
      setName("");
      setIsOwnGame(false);
      onAdded();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border p-4">
      <h3 className="font-heading text-base font-medium">Add New Game</h3>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="store">Store</Label>
          <Select value={store} onValueChange={(v) => v && setStore(v)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="playstore">Play Store</SelectItem>
              <SelectItem value="appstore">App Store</SelectItem>
              <SelectItem value="steam">Steam</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="storeId">Store ID</Label>
          <Input
            id="storeId"
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            placeholder="com.example.game"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Game Name"
            required
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isOwnGame"
          checked={isOwnGame}
          onChange={(e) => setIsOwnGame(e.target.checked)}
          className="size-4 rounded border-border"
        />
        <Label htmlFor="isOwnGame">This is our own game</Label>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={submitting}>
        {submitting ? "Adding..." : "Add Game"}
      </Button>
    </form>
  );
}
