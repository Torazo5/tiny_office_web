"use client";

import { ConfidenceDot } from "@/components/confidence-dot";
import { usePlayer } from "@/components/player-context";
import { formatClipDuration, formatTime } from "@/lib/format";
import type { Song } from "@/lib/types";

/** Click to seek — reseeks the embed (via PlayerProvider) to this song's clip_start. */
export function SongRow({ song }: { song: Song }) {
  const { startAt, setStartAt } = usePlayer();
  const confirmed = !song.suspect && song.confidence >= 75;
  const active = Math.floor(startAt) === Math.floor(song.clipStart);

  return (
    <button
      type="button"
      onClick={() => setStartAt(song.clipStart)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
        active ? "bg-secondary" : "hover:bg-secondary/60"
      }`}
    >
      <div className="w-5 text-center font-mono text-xs text-muted-foreground">
        {song.index}
      </div>
      <ConfidenceDot verified={confirmed} size={8} />
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-medium text-foreground truncate">
          {song.title}
        </div>
        {!confirmed && (
          <div className="text-[11.5px] text-primary mt-0.5">
            Unconfirmed boundaries
          </div>
        )}
      </div>
      <div className="font-mono text-xs text-muted-foreground">
        {formatTime(song.clipStart)}
      </div>
      <div className="font-mono text-xs text-muted-foreground/70 w-[38px] text-right">
        {formatClipDuration(song.clipStart, song.clipEnd)}
      </div>
    </button>
  );
}
