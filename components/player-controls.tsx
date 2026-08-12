"use client";

import { useRef, useState } from "react";
import { Repeat2, Shuffle, SkipBack, SkipForward } from "lucide-react";
import { formatTime } from "@/lib/format";
import { VolumeMeter } from "@/components/volume-meter";

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
  previousLabel?: string;
  nextLabel?: string;
  onPreviousSong?: () => void;
  onNextSong?: () => void;
  previousSongDisabled?: boolean;
  nextSongDisabled?: boolean;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
  isShuffling?: boolean;
  onToggleShuffle?: () => void;
  isLooping?: boolean;
  onToggleLoop?: () => void;
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
  playButtonHintTarget?: string;
  compact?: boolean;
  modeControl?: React.ReactNode;
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
  previousLabel = "Previous song",
  nextLabel = "Next song",
  onPreviousSong,
  onNextSong,
  previousSongDisabled = false,
  nextSongDisabled = false,
  previousDisabled = false,
  nextDisabled = false,
  isShuffling = false,
  onToggleShuffle,
  isLooping = false,
  onToggleLoop,
  onScrubStart,
  onScrubEnd,
  volume,
  onVolumeChange,
  playButtonHintTarget,
  compact = false,
  modeControl,
}: PlayerControlsProps) {
  const duration = Math.max(0, rangeEnd - rangeStart);
  const sliderMax = Math.max(0.1, duration);
  const currentRelativeTime = clamp(currentTime - rangeStart, 0, duration);
  const [draftValue, setDraftValue] = useState<number | null>(null);
  const [showMore, setShowMore] = useState(false);
  const draftValueRef = useRef<number | null>(null);
  const scrubbingRef = useRef(false);
  const displayedValue = draftValue ?? currentRelativeTime;
  const canInteract = isReady && duration > 0;

  function beginScrub(event?: React.PointerEvent<HTMLInputElement>) {
    if (!canInteract) return;
    if (event) event.currentTarget.setPointerCapture(event.pointerId);
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

  if (compact) {
    return (
      <section className="mt-3 rounded-lg border border-border bg-secondary/35 p-2.5" aria-label="Playback controls">
        <div className="relative flex min-h-9 items-center justify-between gap-2">
          <div className="w-20 shrink-0 sm:w-28">
            <VolumeMeter value={volume} onChange={onVolumeChange} disabled={!isReady} compact />
          </div>

          <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1.5">
            {onPrevious && (
              <button
                type="button"
                onClick={onPrevious}
                disabled={!isReady || previousDisabled}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-input text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:cursor-default disabled:opacity-40"
                aria-label={previousLabel}
                title={previousLabel}
              >
                <SkipBack size={15} aria-hidden />
              </button>
            )}
            <button
              type="button"
              onClick={onTogglePlay}
              disabled={!isReady}
              data-feature-hint={playButtonHintTarget}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <span aria-hidden className="flex gap-1">
                  <span className="h-3.5 w-1 rounded-sm bg-primary-foreground" />
                  <span className="h-3.5 w-1 rounded-sm bg-primary-foreground" />
                </span>
              ) : (
                <span aria-hidden className="ml-0.5 block h-0 w-0 border-y-[6px] border-l-[9px] border-y-transparent border-l-primary-foreground" />
              )}
            </button>
            {onNext && (
              <button
                type="button"
                onClick={onNext}
                disabled={!isReady || nextDisabled}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-input text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:cursor-default disabled:opacity-40"
                aria-label={nextLabel}
                title={nextLabel}
              >
                <SkipForward size={15} aria-hidden />
              </button>
            )}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {modeControl}
            {onToggleLoop && (
              <button
                type="button"
                onClick={onToggleLoop}
                disabled={!isReady}
                aria-pressed={isLooping}
                className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors disabled:cursor-wait disabled:opacity-40 ${
                  isLooping ? "border-primary/60 bg-primary/15 text-primary" : "border-input text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
                aria-label={isLooping ? "Turn off loop" : "Loop current song"}
              >
                <Repeat2 size={15} aria-hidden />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowMore((open) => !open)}
              className={`rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors ${
                showMore ? "border-primary/50 bg-primary/10 text-primary" : "border-input text-muted-foreground hover:text-foreground"
              }`}
              aria-expanded={showMore}
            >
              More
            </button>
          </div>
        </div>

        {(onPreviousSong || onNextSong) && (
          <div className="mt-2 flex items-center justify-center gap-1.5 border-t border-border pt-2">
            <span className="mr-1 text-[11px] font-medium text-muted-foreground">Song</span>
            {onPreviousSong && (
              <button
                type="button"
                onClick={onPreviousSong}
                disabled={!isReady || previousSongDisabled}
                className="flex h-8 items-center gap-1 rounded-md border border-input px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:cursor-default disabled:opacity-40"
                aria-label="Previous song"
                title="Previous song in this video"
              >
                <SkipBack size={14} aria-hidden />
                Previous
              </button>
            )}
            {onNextSong && (
              <button
                type="button"
                onClick={onNextSong}
                disabled={!isReady || nextSongDisabled}
                className="flex h-8 items-center gap-1 rounded-md border border-input px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:cursor-default disabled:opacity-40"
                aria-label="Next song"
                title="Next song in this video"
              >
                Next
                <SkipForward size={14} aria-hidden />
              </button>
            )}
          </div>
        )}

        <div className="mt-2 border-t border-border pt-2">
          <label className="block">
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
              onLostPointerCapture={commitScrub}
              onKeyUp={commitScrub}
              onBlur={commitScrub}
              onChange={(event) => changeScrub(event.target.value)}
              disabled={!canInteract}
              className="w-full accent-primary disabled:opacity-50"
              aria-label="Seek video"
            />
          </label>
          <div className="mt-0.5 flex justify-between font-mono text-[10px] text-muted-foreground">
            <span>{formatTime(displayedValue)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {showMore && (
          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-2">
            {onToggleShuffle && (
              <button
                type="button"
                onClick={onToggleShuffle}
                disabled={!isReady}
                aria-pressed={isShuffling}
                className={`flex h-8 w-8 items-center justify-center rounded-md border transition-colors disabled:cursor-wait disabled:opacity-40 ${
                  isShuffling ? "border-primary/50 bg-primary/10 text-primary" : "border-input text-muted-foreground hover:text-foreground"
                }`}
                aria-label={isShuffling ? "Turn off shuffle" : "Shuffle playlist"}
              >
                <Shuffle size={16} aria-hidden />
              </button>
            )}
            <button
              type="button"
              onClick={() => onSkip(-10)}
              disabled={!isReady}
              className="rounded-md border border-input px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-wait disabled:opacity-40"
            >
              −10s
            </button>
            <button
              type="button"
              onClick={() => onSkip(30)}
              disabled={!isReady}
              className="rounded-md border border-input px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-wait disabled:opacity-40"
            >
              +30s
            </button>
            <span className="font-mono text-[10px] text-muted-foreground sm:hidden">
              {formatTime(displayedValue)} / {formatTime(duration)}
            </span>
          </div>
        )}
      </section>
    );
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
              aria-label={previousLabel}
              title={previousLabel}
            >
              <SkipBack size={18} aria-hidden />
            </button>
          )}

          <button
            type="button"
            onClick={onTogglePlay}
            disabled={!isReady}
            data-feature-hint={playButtonHintTarget}
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
              aria-label={nextLabel}
              title={nextLabel}
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
          onLostPointerCapture={commitScrub}
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

      <div className="mt-3 border-t border-border pt-3">
        <VolumeMeter value={volume} onChange={onVolumeChange} disabled={!isReady} />
      </div>
    </section>
  );
}
