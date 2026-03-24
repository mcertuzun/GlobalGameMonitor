"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AppCardProps {
  app: {
    id: number;
    store: string;
    storeId: string;
    name: string;
    developer: string | null;
    category: string | null;
    iconUrl: string | null;
    isOwnGame: boolean | null;
  };
}

export function AppCard({ app }: AppCardProps) {
  return (
    <Link href={`/apps/${app.id}`}>
      <Card className="transition-shadow hover:shadow-md cursor-pointer">
        <CardContent className="flex items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted text-2xl">
            {app.iconUrl ? (
              <img
                src={app.iconUrl}
                alt={app.name}
                className="size-12 rounded-lg object-cover"
              />
            ) : (
              "🎮"
            )}
          </div>
          <div className="flex flex-1 flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{app.name}</span>
              {app.isOwnGame && (
                <Badge variant="secondary">Own</Badge>
              )}
            </div>
            {app.developer && (
              <span className="text-sm text-muted-foreground truncate">
                {app.developer}
              </span>
            )}
            <div className="flex items-center gap-2">
              <Badge variant="outline">{app.store}</Badge>
              {app.category && (
                <Badge variant="outline">{app.category}</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
