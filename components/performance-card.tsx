"use client";

import Link from "next/link";
import { trackEvent } from "@/components/analytics";
import { AddToPlaylistButton } from "@/components/add-to-playlist-button";
import { ConfidenceDot } from "@/components/confidence-dot";
import { StarRating } from "@/components/star-rating";
import { YouTubeThumbnail } from "@/components/youtube-thumbnail";
import { getConcertPath } from "@/lib/seo-routes";
import type { Performance, PlaylistSummary } from "@/lib/types";

export function PerformanceCard({
  performance: p,
  playlists,
  isSignedIn,
}: {
  performance: Performance;
  playlists: PlaylistSummary[];
  isSignedIn: boolean;
}) {
  const concertPath = getConcertPath(p);

  return (
    <article className="min-w-0">
      <Link
        href={concertPath}
        onClick={() => trackEvent({ eventName: "performance_opened", source: "catalog_card", performanceVideoId: p.videoId })}
        className="group block"
      >
        <div className="relative aspect-video rounded-[10px] overflow-hidden mb-2.5">
          <YouTubeThumbnail
            videoId={p.videoId}
            alt={`${p.artist} Tiny Desk Concert`}
            className="h-full w-full"
          />
          <ConfidenceDot
            verified={p.verified}
            className="absolute top-2 right-2 ring-[3px] ring-background/60"
          />
          <div className="absolute bottom-2 right-2 bg-background/75 text-foreground font-mono text-[11px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap">
            {p.songs.length} songs
          </div>
        </div>
        <div className="font-semibold text-[14.5px] text-foreground mb-0.5 group-hover:text-primary transition-colors">
          {p.artist}
        </div>
        <div className="text-[12.5px] text-muted-foreground mb-1.5">
          Tiny Desk Concert{p.date ? ` · ${p.date}` : ""}
        </div>
        {p.avgRating !== null && (
          <div className="flex items-baseline gap-1.5 text-[12.5px]">
            <StarRating rating={p.avgRating} size="text-[12.5px]" />
            <span className="font-mono text-xs text-muted-foreground">
              {p.avgRating.toFixed(1)} · {p.ratingCount.toLocaleString()}
            </span>
          </div>
        )}
      </Link>
      <div className="mt-2">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={concertPath}
            onClick={() => trackEvent({ eventName: "performance_opened", source: "catalog_play_action", performanceVideoId: p.videoId })}
            className="inline-flex min-h-9 items-center rounded-md bg-primary px-2.5 py-1.5 text-[12px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 sm:min-h-0"
          >
            Play a song
          </Link>
          <AddToPlaylistButton
            item={{ kind: "video", performanceVideoId: p.videoId }}
            playlists={playlists}
            isSignedIn={isSignedIn}
          />
        </div>
      </div>
    </article>
  );
}
