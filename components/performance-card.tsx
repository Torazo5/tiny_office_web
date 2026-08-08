import Link from "next/link";
import { AddToPlaylistButton } from "@/components/add-to-playlist-button";
import { ConfidenceDot } from "@/components/confidence-dot";
import { PlaceholderThumb } from "@/components/placeholder-thumb";
import { StarRating } from "@/components/star-rating";
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
  return (
    <article className="min-w-0">
      <Link href={`/video/${p.videoId}`} className="group block">
        <div className="relative aspect-video rounded-[10px] overflow-hidden mb-2.5">
          <PlaceholderThumb label="THUMBNAIL" className="h-full w-full" />
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
        <AddToPlaylistButton
          item={{ kind: "video", performanceVideoId: p.videoId }}
          playlists={playlists}
          isSignedIn={isSignedIn}
        />
      </div>
    </article>
  );
}
