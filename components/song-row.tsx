"use client";

import { ConfidenceDot } from "@/components/confidence-dot";
import { usePlayer } from "@/components/player-context";
import { SongHeartButton } from "@/components/song-heart-button";
import { formatClipDuration, formatTime } from "@/lib/format";
import type { Song } from "@/lib/types";

/** Click to seek — reseeks the embed (via PlayerProvider) to this song's clip_start. */
export function SongRow({
  song,
  performanceVideoId,
  initialHearted = false,
  initialHeartCount = 0,
  isSignedIn = false,
}: {
  song: Song;
  performanceVideoId?: string;
  initialHearted?: boolean;
  initialHeartCount?: number;
  isSignedIn?: boolean;
}) {
  const { currentTime, setStartAt } = usePlayer();
  // `suspect` is the persisted boundary decision. An admin can confirm a
  // low-confidence AI boundary after listening, so confidence must not
  // override that explicit decision.
  const confirmed = !song.suspect;
  const effectiveClipEnd = Math.max(song.clipEnd, song.clipStart + 0.5);
  const active = currentTime >= song.clipStart && currentTime < effectiveClipEnd;

  return (
    <div className={`flex items-center gap-1 rounded-lg transition-colors ${active ? "bg-primary/10 ring-1 ring-inset ring-primary/40" : "hover:bg-secondary/60"}`}>
      <button
        type="button"
        onClick={() => setStartAt(song.clipStart)}
        aria-current={active ? "true" : undefined}
        aria-label={`${song.title}, ${formatTime(song.clipStart)} to ${formatTime(song.clipEnd)}, ${formatClipDuration(song.clipStart, song.clipEnd)} duration`}
        className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left"
      >
        <div className="w-5 text-center font-mono text-xs text-muted-foreground">
          {song.index}
        </div>
        <ConfidenceDot verified={confirmed} size={8} />
        <div className="flex-1 min-w-0">
          <div className={`text-[13.5px] font-medium truncate ${active ? "text-primary" : "text-foreground"}`}>
            {song.title}
          </div>
          {!confirmed && (
            <div className="text-[11.5px] text-primary mt-0.5">
              Unconfirmed boundaries
            </div>
          )}
        </div>
        <div className="shrink-0 whitespace-nowrap text-right font-mono text-[11px] leading-tight text-muted-foreground">
          <div>
            {formatTime(song.clipStart)}
            <span aria-hidden className="px-1 text-muted-foreground/50">→</span>
            {formatTime(song.clipEnd)}
          </div>
          <div className="mt-0.5 text-[10px] text-muted-foreground/70">
            {formatClipDuration(song.clipStart, song.clipEnd)} duration
          </div>
        </div>
      </button>
      {performanceVideoId && (
        <SongHeartButton
          performanceVideoId={performanceVideoId}
          songIndex={song.index}
          initialHearted={initialHearted}
          initialHeartCount={initialHeartCount}
          isSignedIn={isSignedIn}
          returnPath={`/video/${performanceVideoId}`}
        />
      )}
    </div>
  );
}
