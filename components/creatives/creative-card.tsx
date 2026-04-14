"use client";

import { Badge } from "@/components/ui/badge";
import { useState } from "react";

export interface CreativeCardData {
  id: number;
  platform: string;
  creativeType: string | null;
  creativeUrl: string | null;
  headline: string | null;
  adCopy: string | null;
  cta?: string | null;
  firstSeen: string | null;
  lastSeen: string | null;
  isActive: boolean | null;
  isNew?: boolean;
  countries: string[];
  platforms: string[];
  variantSiblings?: number;
  variantCount?: number;
  daysActive?: number;
  countriesCount?: number;
  impressionsLower: number | null;
  impressionsUpper: number | null;
  investmentScore: number;
  shareOfVoice?: number;
}

function formatImpressions(
  lower: number | null,
  upper: number | null
): string | null {
  if (!lower && !upper) return null;
  const fmt = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
    return `${n}`;
  };
  if (lower && upper) return `${fmt(lower)}–${fmt(upper)}`;
  return fmt((lower ?? upper)!);
}

/**
 * SensorTower-style creative card. Click to reveal the Meta snapshot in an
 * iframe — Meta's render URL serves the full creative (video/image/carousel).
 */
export function CreativeCard({ creative }: { creative: CreativeCardData }) {
  const [expanded, setExpanded] = useState(false);
  const impressionsLabel = formatImpressions(
    creative.impressionsLower,
    creative.impressionsUpper
  );
  const variantCount = creative.variantCount ?? creative.variantSiblings ?? 1;

  return (
    <div className="rounded-lg border overflow-hidden flex flex-col bg-card">
      <div className="relative aspect-[9/16] bg-muted">
        {expanded && creative.creativeUrl ? (
          <iframe
            src={creative.creativeUrl}
            title={creative.headline ?? `Creative ${creative.id}`}
            className="absolute inset-0 w-full h-full"
            sandbox="allow-scripts allow-same-origin allow-popups"
            loading="lazy"
          />
        ) : (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:bg-muted/80 transition"
            aria-label="Play creative"
          >
            <div className="h-14 w-14 rounded-full bg-background/80 flex items-center justify-center text-2xl">
              ▶
            </div>
            <span className="text-xs">
              {creative.creativeType ?? "creative"} · tap to preview
            </span>
          </button>
        )}

        <div className="absolute top-2 left-2 flex gap-1">
          <Badge variant="outline" className="text-[10px] bg-background/90">
            {creative.platform}
          </Badge>
          {creative.creativeType && (
            <Badge variant="secondary" className="text-[10px]">
              {creative.creativeType}
            </Badge>
          )}
          {creative.isNew && (
            <Badge className="text-[10px]">NEW</Badge>
          )}
        </div>
        <div className="absolute top-2 right-2">
          <Badge
            variant={creative.isActive ? "default" : "secondary"}
            className="text-[10px]"
          >
            {creative.isActive ? "live" : "paused"}
          </Badge>
        </div>
      </div>

      <div className="p-3 space-y-2 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium line-clamp-2">
              {creative.headline ?? creative.adCopy ?? "(no copy)"}
            </p>
            {creative.headline && creative.adCopy && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                {creative.adCopy}
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="font-mono text-sm font-semibold">
              {creative.investmentScore.toLocaleString()}
            </div>
            {creative.shareOfVoice !== undefined && (
              <div className="text-[10px] text-muted-foreground">
                {creative.shareOfVoice}% SoV
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground mt-auto">
          {creative.daysActive !== undefined && (
            <span>{creative.daysActive}d</span>
          )}
          <span>·</span>
          <span>
            {creative.countriesCount ?? creative.countries.length} countries
          </span>
          {variantCount > 1 && (
            <>
              <span>·</span>
              <span>{variantCount} variants</span>
            </>
          )}
          {impressionsLabel && (
            <>
              <span>·</span>
              <span>{impressionsLabel} imp</span>
            </>
          )}
        </div>

        {creative.countries.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {creative.countries.slice(0, 8).map((c) => (
              <span
                key={c}
                className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-mono"
              >
                {c}
              </span>
            ))}
            {creative.countries.length > 8 && (
              <span className="text-[10px] text-muted-foreground">
                +{creative.countries.length - 8}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
