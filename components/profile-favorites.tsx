"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { removeFavorite, saveFavorite } from "@/app/profile/actions";
import { YouTubeThumbnail } from "@/components/youtube-thumbnail";

type Favorite = {
  position: number;
  performanceVideoId: string | null;
  artist: string | null;
  date: string | null;
};

type PerformanceOption = {
  videoId: string;
  artist: string;
  date: string | null;
};

export function ProfileFavorites({
  favorites,
  performances,
}: {
  favorites: Favorite[];
  performances: PerformanceOption[];
}) {
  const [currentFavorites, setCurrentFavorites] = useState(favorites);
  const [pendingPosition, setPendingPosition] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateFavorite(position: number, videoId: string) {
    const previous = currentFavorites.find((favorite) => favorite.position === position);
    setError(null);
    setPendingPosition(position);
    startTransition(async () => {
      const result = videoId
        ? await saveFavorite(position, videoId)
        : await removeFavorite(position);
      if (result?.error) {
        setError(result.error);
      } else {
        const performance = performances.find((item) => item.videoId === videoId);
        setCurrentFavorites((current) => current.map((favorite) => {
          if (favorite.position === position) {
            return {
              ...favorite,
              performanceVideoId: performance?.videoId ?? null,
              artist: performance?.artist ?? null,
              date: performance?.date ?? null,
            };
          }
          if (videoId && favorite.performanceVideoId === videoId) {
            return { ...favorite, performanceVideoId: null, artist: null, date: null };
          }
          return favorite;
        }));
      }
      setPendingPosition(null);
    });

    if (previous?.performanceVideoId === videoId) setError(null);
  }

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Top four</h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">Your four favorite Tiny Desk performances.</p>
        </div>
        {error && <p className="text-[12px] text-primary">{error}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {currentFavorites.map((favorite) => (
          <article key={favorite.position} className="min-w-0 rounded-xl border border-border bg-card/50 p-2.5">
            {favorite.performanceVideoId ? (
              <Link href={`/video/${favorite.performanceVideoId}`} className="group block">
                <div className="relative mb-2 aspect-video overflow-hidden rounded-lg">
                  <YouTubeThumbnail
                    videoId={favorite.performanceVideoId}
                    alt={`${favorite.artist ?? "Tiny Desk"} Tiny Desk Concert`}
                    className="h-full w-full"
                  />
                  <span className="absolute left-2 top-2 rounded bg-background/80 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                    #{favorite.position}
                  </span>
                </div>
                <div className="truncate text-[13px] font-semibold text-foreground group-hover:text-primary">
                  {favorite.artist}
                </div>
                <div className="truncate text-[11.5px] text-muted-foreground">
                  Tiny Desk Concert{favorite.date ? ` · ${favorite.date}` : ""}
                </div>
              </Link>
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-border bg-secondary/40 px-3 text-center">
                <span className="text-[12px] text-muted-foreground">Choose a favorite</span>
              </div>
            )}
            <label className="sr-only" htmlFor={`favorite-${favorite.position}`}>
              Top four slot {favorite.position}
            </label>
            <select
              id={`favorite-${favorite.position}`}
              value={favorite.performanceVideoId ?? ""}
              onChange={(event) => updateFavorite(favorite.position, event.target.value)}
              disabled={isPending}
              className="mt-2 w-full rounded-md border border-input bg-secondary px-2 py-1.5 text-[11.5px] text-foreground outline-none focus:border-primary disabled:opacity-60"
            >
              <option value="">Empty slot</option>
              {performances.map((performance) => (
                <option key={performance.videoId} value={performance.videoId}>
                  {performance.artist}
                </option>
              ))}
            </select>
            {pendingPosition === favorite.position && (
              <div className="mt-1 text-[11px] text-muted-foreground">Saving…</div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
