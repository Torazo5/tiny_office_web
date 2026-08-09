"use client";

import { useEffect, useRef } from "react";
import { PlayerControls } from "@/components/player-controls";
import { usePlayer } from "@/components/player-context";
import type { Song } from "@/lib/types";

/**
 * Attaches the shared player to the full-size page host. The iframe itself is
 * owned by PlayerProvider and is moved to the root mini-player when this page
 * unmounts, so route changes do not interrupt playback.
 */
export function VideoEmbed({
  videoId,
  title,
  duration,
  songs,
}: {
  videoId: string;
  title: string;
  duration: number;
  songs: Song[];
}) {
  const fullHostRef = useRef<HTMLDivElement>(null);
  const {
    currentTime,
    onlySongMode,
    setOnlySongMode,
    activateVideo,
    attachPlayerHost,
    togglePlay,
    seekTo,
    skipBy,
    isPlaying,
    isReady,
  } = usePlayer();
  const safeDuration = Math.max(0, duration);

  useEffect(() => {
    attachPlayerHost(fullHostRef.current);
    return () => attachPlayerHost(null);
  }, [attachPlayerHost, videoId]);

  useEffect(() => {
    activateVideo({
      videoId,
      title,
      duration: safeDuration,
      songs,
      initialStart: songs[0]?.clipStart ?? 0,
    });
  }, [activateVideo, safeDuration, songs, title, videoId]);

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-end">
        <button
          type="button"
          aria-pressed={onlySongMode}
          onClick={() => setOnlySongMode(!onlySongMode)}
          className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
            onlySongMode
              ? "border-primary/50 bg-primary/10 text-primary"
              : "border-border bg-secondary text-muted-foreground hover:text-foreground"
          }`}
        >
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${
              onlySongMode ? "bg-primary" : "bg-muted-foreground/50"
            }`}
          />
          Only song mode
        </button>
      </div>

      <div
        ref={fullHostRef}
        className="relative aspect-video overflow-hidden rounded-[10px] border border-border bg-black"
        aria-label="Tiny Desk video player"
      />

      <PlayerControls
        currentTime={currentTime}
        rangeStart={0}
        rangeEnd={safeDuration}
        isPlaying={isPlaying}
        isReady={isReady}
        onTogglePlay={togglePlay}
        onSeek={seekTo}
        onSkip={skipBy}
      />
    </div>
  );
}
