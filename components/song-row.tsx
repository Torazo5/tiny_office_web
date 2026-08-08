import { ConfidenceDot } from "@/components/confidence-dot";
import { formatClipDuration, formatTime } from "@/lib/format";
import type { Song } from "@/lib/types";

/**
 * "Click to seek" per the design handoff — not wired up here since there's
 * no player instance to control yet (the video embed is a static
 * placeholder). Codex should turn this into a button that scrubs the
 * YouTube player to `song.clipStart`.
 */
export function SongRow({ song }: { song: Song }) {
  const confirmed = !song.suspect && song.confidence >= 75;
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors">
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
    </div>
  );
}
