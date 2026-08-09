"use client";

import { Maximize2, Pause, Play, SkipBack, SkipForward, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { RefObject } from "react";
import { formatTime } from "@/lib/format";

type PersistentPlayerDockProps = {
  videoId: string | null;
  title: string;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isReady: boolean;
  isBuffering: boolean;
  isFullAttached: boolean;
  miniHostRef: RefObject<HTMLDivElement | null>;
  onTogglePlay: () => void;
  onSeek: (seconds: number, allowSeekAhead: boolean) => void;
  onSkip: (seconds: number) => void;
  onClose: () => void;
};

export function PersistentPlayerDock({
  videoId,
  title,
  currentTime,
  duration,
  isPlaying,
  isReady,
  isBuffering,
  isFullAttached,
  miniHostRef,
  onTogglePlay,
  onSeek,
  onSkip,
  onClose,
}: PersistentPlayerDockProps) {
  const router = useRouter();
  const visible = Boolean(videoId) && !isFullAttached;
  const safeDuration = Math.max(0, duration);
  const safeCurrentTime = Math.min(Math.max(0, currentTime), safeDuration);

  function openFullPlayer() {
    if (videoId) router.push(`/video/${videoId}`);
  }

  return (
    <div
      className={visible ? "pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-3 sm:px-6" : "hidden"}
    >
      <section className="pointer-events-auto relative mx-auto flex max-w-[1180px] items-center gap-3 rounded-xl border border-border bg-card/95 p-2.5 shadow-2xl backdrop-blur sm:gap-4 sm:p-3">
        <div
          ref={miniHostRef}
          className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-black sm:h-16 sm:w-28"
          aria-label="Mini video player"
        />

        <button
          type="button"
          onClick={openFullPlayer}
          className="min-w-0 flex-1 text-left"
          aria-label="Open full player"
        >
          <div className="truncate text-[13px] font-semibold text-foreground">{title}</div>
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {isBuffering ? "Loading…" : `${formatTime(safeCurrentTime)} / ${formatTime(safeDuration)}`}
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          <button
            type="button"
            onClick={() => onSkip(-10)}
            disabled={!isReady}
            className="hidden h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-wait disabled:opacity-40 sm:flex"
            aria-label="Skip back 10 seconds"
          >
            <SkipBack size={15} aria-hidden />
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            disabled={!isReady}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause size={16} aria-hidden /> : <Play size={16} className="ml-0.5" aria-hidden />}
          </button>
          <button
            type="button"
            onClick={() => onSkip(30)}
            disabled={!isReady}
            className="hidden h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-wait disabled:opacity-40 sm:flex"
            aria-label="Skip ahead 30 seconds"
          >
            <SkipForward size={15} aria-hidden />
          </button>
          <button
            type="button"
            onClick={openFullPlayer}
            className="ml-1 hidden h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:flex"
            aria-label="Open full player"
          >
            <Maximize2 size={15} aria-hidden />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Close mini-player"
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        <label className="absolute inset-x-3 -bottom-0.5 block sm:inset-x-4">
          <span className="sr-only">Seek video</span>
          <input
            type="range"
            min={0}
            max={Math.max(0.1, safeDuration)}
            step={0.1}
            value={safeCurrentTime}
            onChange={(event) => onSeek(Number(event.target.value), true)}
            disabled={!isReady || safeDuration <= 0}
            className="block h-1 w-full cursor-pointer accent-primary disabled:cursor-default disabled:opacity-40"
            aria-label="Seek video"
          />
        </label>
      </section>
    </div>
  );
}
