"use client";

import { useState } from "react";
import { PerformanceCard } from "@/components/performance-card";
import { trackEvent } from "@/components/analytics";
import type { Performance, PlaylistSummary } from "@/lib/types";

function CatalogSkeletons() {
  return Array.from({ length: 4 }, (_, index) => (
    <div key={index} className="animate-pulse" aria-hidden>
      <div className="aspect-video rounded-[10px] bg-secondary" />
      <div className="mt-3 h-4 w-3/5 rounded bg-secondary" />
      <div className="mt-2 h-3 w-2/5 rounded bg-secondary" />
      <div className="mt-3 h-8 w-28 rounded bg-secondary" />
    </div>
  ));
}

export function CatalogGrid({
  initialPerformances,
  initialNextOffset,
  initialHasMore,
  playlists,
  isSignedIn,
}: {
  initialPerformances: Performance[];
  initialNextOffset: number;
  initialHasMore: boolean;
  playlists: PlaylistSummary[];
  isSignedIn: boolean;
}) {
  const [performances, setPerformances] = useState(initialPerformances);
  const [nextOffset, setNextOffset] = useState(initialNextOffset);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMore() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/catalog?offset=${nextOffset}`);
      if (!response.ok) throw new Error("Catalog request failed");
      const page = await response.json() as {
        performances: Performance[];
        hasMore: boolean;
        nextOffset: number;
      };
      setPerformances((current) => {
        const known = new Set(current.map((performance) => performance.videoId));
        return [...current, ...page.performances.filter((performance) => !known.has(performance.videoId))];
      });
      setNextOffset(page.nextOffset);
      setHasMore(page.hasMore);
      trackEvent({ eventName: "catalog_load_more", source: "catalog_grid", loadMorePage: Math.floor(nextOffset / 12) + 1 });
    } catch {
      setError("Couldn’t load more performances. Check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <div
        className="grid gap-[22px]"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}
        aria-busy={isLoading}
      >
        {performances.map((performance) => (
          <PerformanceCard
            key={performance.videoId}
            performance={performance}
            playlists={playlists}
            isSignedIn={isSignedIn}
          />
        ))}
        {isLoading && <CatalogSkeletons />}
      </div>
      {(hasMore || error) && (
        <div className="mt-8 flex flex-col items-center gap-3">
          {error && <p className="text-[13px] text-primary" role="status">{error}</p>}
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={isLoading}
            className="rounded-lg border border-input px-4 py-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:cursor-wait disabled:opacity-60"
          >
            {isLoading ? "Loading performances…" : error ? "Try loading again" : "Load more performances"}
          </button>
        </div>
      )}
    </>
  );
}
