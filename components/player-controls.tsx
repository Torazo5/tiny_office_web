"use client";

import { useRef, useState } from "react";
import { Repeat2, Shuffle, SkipBack, SkipForward } from "lucide-react";
import { formatTime } from "@/lib/format";

type PlayerControlsProps = {
  currentTime: number;
  rangeStart: number;
  rangeEnd: number;
  isPlaying: boolean;
  isReady: boolean;
  onTogglePlay: () => void;
  onSeek: (seconds: number, allowSeekAhead: boolean) => void;
  onSkip: (seconds: number) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
  isShuffling?: boolean;
  onToggleShuffle?: () => void;
  isLooping?: boolean;
  onToggleLoop?: () => void;
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function PlayerControls({
  currentTime,
  rangeStart,
  rangeEnd,
  isPlaying,
  isReady,
  onTogglePlay,
  onSeek,
  onSkip,
  onPrevious,
  onNext,
  previousDisabled = false,
  nextDisabled = false,
  isShuffling = false,
  onToggleShuffle,
  isLooping = false,
  onToggleLoop,
  onScrubStart,
  onScrubEnd,
}: PlayerControlsProps) {
  const duration = Math.max(0, rangeEnd - rangeStart);
  const sliderMax = Math.max(0.1, duration);
  const currentRelativeTime = clamp(currentTime - rangeStart, 0, duration);
  const [draftValue, setDraftValue] = useState<number | null>(null);
  const draftValueRef = useRef<number | null>(null);
  const scrubbingRef = useRef(false);
  const displayedValue = draftValue ?? currentRelativeTime;
  const canInteract = isReady && duration > 0;

  function beginScrub() {
    if (!canInteract) return;
    draftValueRef.current = currentRelativeTime;
    setDraftValue(currentRelativeTime);
    if (!scrubbingRef.current) {
      scrubbingRef.current = true;
      onScrubStart?.();
    }
  }

  function changeScrub(value: string) {
    const nextValue = clamp(Number(value), 0, duration);
    if (!Number.isFinite(nextValue)) return;
    if (!scrubbingRef.current) beginScrub();
    draftValueRef.current = nextValue;
    setDraftValue(nextValue);
    onSeek(rangeStart + nextValue, false);
  }

  function commitScrub() {
    const nextValue = draftValueRef.current;
    if (nextValue !== null) onSeek(rangeStart + nextValue, true);
    draftValueRef.current = null;
    setDraftValue(null);
    if (scrubbingRef.current) {
      scrubbingRef.current = false;
      onScrubEnd?.();
    }
  }

  return (
    <section className="mt-4 rounded-lg border border-border bg-secondary/35 p-3.5" aria-label="Playback controls">
      <div className="relative flex min-h-11 items-center justify-center">
        <div className="flex items-center gap-4">
          {onPrevious && (
            <button
              type="button"
              onClick={onPrevious}
              disabled={!isReady || previousDisabled}
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-default disabled:opacity-40"
              aria-label="Previous song"
            >
              <SkipBack size={18} aria-hidden />
            </button>
          )}

          <button
            type="button"
            onClick={onTogglePlay}
            disabled={!isReady}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <span aria-hidden className="flex gap-1">
                <span className="h-4 w-1 rounded-sm bg-primary-foreground" />
                <span className="h-4 w-1 rounded-sm bg-primary-foreground" />
              </span>
            ) : (
              <span aria-hidden className="ml-0.5 block h-0 w-0 border-y-[7px] border-l-[11px] border-y-transparent border-l-primary-foreground" />
            )}
          </button>

          {onNext && (
            <button
              type="button"
              onClick={onNext}
              disabled={!isReady || nextDisabled}
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-default disabled:opacity-40"
              aria-label="Next song"
            >
              <SkipForward size={18} aria-hidden />
            </button>
          )}
        </div>

        {onToggleShuffle && (
          <button
            type="button"
            onClick={onToggleShuffle}
            disabled={!isReady}
            aria-pressed={isShuffling}
            aria-label={isShuffling ? "Turn off shuffle" : "Shuffle playlist"}
            className={`absolute left-0 flex h-9 w-9 items-center justify-center rounded-full transition-colors disabled:cursor-wait disabled:opacity-40 ${
              isShuffling
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Shuffle size={18} aria-hidden />
          </button>
        )}

        {onToggleLoop && (
          <button
            type="button"
            onClick={onToggleLoop}
            disabled={!isReady}
            aria-pressed={isLooping}
            aria-label={isLooping ? "Turn off loop" : "Loop current song"}
            className={`absolute right-0 flex h-9 w-9 items-center justify-center rounded-full transition-colors disabled:cursor-wait disabled:opacity-40 ${
              isLooping
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Repeat2 size={18} aria-hidden />
          </button>
        )}
      </div>

      <div className="mt-3 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => onSkip(-10)}
          disabled={!isReady}
          className="rounded-md border border-input px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-wait disabled:opacity-40"
          aria-label="Skip back 10 seconds"
        >
          −10s
        </button>
        <button
          type="button"
          onClick={() => onSkip(30)}
          disabled={!isReady}
          className="rounded-md border border-input px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-wait disabled:opacity-40"
          aria-label="Skip ahead 30 seconds"
        >
          +30s
        </button>
      </div>

      <label className="mt-3 block">
        <span className="sr-only">Seek video</span>
        <input
          type="range"
          min={0}
          max={sliderMax}
          step={0.1}
          value={Math.min(displayedValue, sliderMax)}
          onPointerDown={beginScrub}
          onPointerUp={commitScrub}
          onPointerCancel={commitScrub}
          onKeyUp={commitScrub}
          onBlur={commitScrub}
          onChange={(event) => changeScrub(event.target.value)}
          disabled={!canInteract}
          className="w-full accent-primary disabled:opacity-50"
          aria-label="Seek video"
        />
      </label>

      <div className="mt-1 flex justify-between gap-2 font-mono text-[11px] text-muted-foreground">
        <span>{formatTime(displayedValue)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </section>
  );
}
