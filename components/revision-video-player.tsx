"use client";

import { useEffect, useRef, useState } from "react";
import { VolumeMeter } from "@/components/volume-meter";
import { formatTime } from "@/lib/format";
import {
  createYouTubePlayer,
  isYouTubePlayer,
  loadYouTubeIframeApi,
  type YouTubePlayer,
} from "@/lib/youtube-iframe-api";

const YOUTUBE_PLAYER_PLAYING = 1;

export function RevisionVideoPlayer({
  videoId,
  songKey,
  songTitle,
  clipStart,
  clipEnd,
  duration,
}: {
  videoId: string;
  songKey: string;
  songTitle: string;
  clipStart: number;
  clipEnd: number;
  duration: number;
}) {
  const playerHostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const initialVideoIdRef = useRef(videoId);
  const initialClipStartRef = useRef(clipStart);
  const stopAtRef = useRef<number | null>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [playerState, setPlayerState] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(clipStart);
  const [volume, setVolume] = useState(100);

  function getPlayer() {
    const player = playerRef.current;
    return isYouTubePlayer(player) ? player : null;
  }

  function setPlayerVolume(player: YouTubePlayer, nextVolume: number) {
    const normalizedVolume = Math.min(100, Math.max(0, Math.round(nextVolume)));
    player.setVolume(normalizedVolume);
    setVolume(normalizedVolume);
  }

  useEffect(() => {
    let cancelled = false;

    void loadYouTubeIframeApi()
      .then((api) => {
        if (cancelled || !playerHostRef.current) return;

        const player = createYouTubePlayer(api, playerHostRef.current, initialVideoIdRef.current, {
          onReady: (event) => {
            if (cancelled || !isYouTubePlayer(event.target)) return;
            playerRef.current = event.target;
            event.target.seekTo(initialClipStartRef.current, true);
            setCurrentTime(initialClipStartRef.current);
            setVolume(Math.min(100, Math.max(0, event.target.getVolume())));
            setPlayerState(event.target.getPlayerState());
            setIsPlayerReady(true);
          },
          onStateChange: (event) => {
            if (cancelled || !isYouTubePlayer(event.target)) return;
            setPlayerState(event.data);
          },
        }, initialClipStartRef.current);

        if (player) playerRef.current = player;
      })
      .catch(() => {
        // The native YouTube controls remain available if the API is unavailable.
      });

    return () => {
      cancelled = true;
      const player = playerRef.current;
      if (isYouTubePlayer(player)) player.destroy();
      playerRef.current = null;
    };
    // The iframe is mounted once; song changes seek the same player below.
  }, []);

  useEffect(() => {
    if (!isPlayerReady) return;
    stopAtRef.current = null;
    const player = playerRef.current;
    if (!isYouTubePlayer(player)) return;
    player.seekTo(clipStart, true);
    player.pauseVideo();
    const frameId = window.requestAnimationFrame(() => {
      setCurrentTime(clipStart);
      setPlayerState(2);
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [clipStart, isPlayerReady, songKey]);

  useEffect(() => {
    if (!isPlayerReady) return;

    const intervalId = window.setInterval(() => {
      const player = playerRef.current;
      if (!isYouTubePlayer(player)) return;

      const time = player.getCurrentTime();
      setCurrentTime(time);

      if (stopAtRef.current !== null && time >= stopAtRef.current) {
        player.pauseVideo();
        player.seekTo(clipEnd, true);
        stopAtRef.current = null;
        setCurrentTime(clipEnd);
        setPlayerState(2);
      }
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [clipEnd, isPlayerReady]);

  function playCurrentClip() {
    const player = getPlayer();
    if (!player) return;
    stopAtRef.current = clipEnd;
    player.seekTo(clipStart, true);
    player.playVideo();
    setCurrentTime(clipStart);
  }

  function playFullPerformance() {
    const player = getPlayer();
    if (!player) return;
    stopAtRef.current = null;
    player.seekTo(0, true);
    player.playVideo();
    setCurrentTime(0);
  }

  function pause() {
    stopAtRef.current = null;
    getPlayer()?.pauseVideo();
    setPlayerState(2);
  }

  function seek(value: string) {
    const nextTime = Number(value);
    if (!Number.isFinite(nextTime)) return;
    getPlayer()?.seekTo(nextTime, true);
    setCurrentTime(nextTime);
  }

  const safeCurrentTime = Math.max(0, Math.min(duration, currentTime));
  const clipStartPercent = duration > 0 ? Math.max(0, Math.min(100, (clipStart / duration) * 100)) : 0;
  const clipEndPercent = duration > 0 ? Math.max(0, Math.min(100, (clipEnd / duration) * 100)) : 0;
  const clipWidthPercent = Math.max(0, clipEndPercent - clipStartPercent);

  return (
    <section className="overflow-hidden rounded-[10px] border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Revision playback</div>
          <div className="mt-0.5 text-[13px] font-medium text-foreground">{songTitle}</div>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          {isPlayerReady ? playerState === YOUTUBE_PLAYER_PLAYING ? "Playing" : "Ready" : "Loading"}
        </span>
      </div>

      <div className="relative aspect-video bg-black">
        <div ref={playerHostRef} className="absolute inset-0 h-full w-full" aria-label={`${songTitle} revision playback`} />
      </div>

      <div className="space-y-3 p-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={playCurrentClip}
            disabled={!isPlayerReady}
            className="rounded-lg bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground disabled:opacity-50"
          >
            ▶ Play current clip
          </button>
          <button
            type="button"
            onClick={pause}
            disabled={!isPlayerReady}
            className="rounded-lg border border-input px-3 py-2 text-[12px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            Pause
          </button>
          <button
            type="button"
            onClick={playFullPerformance}
            disabled={!isPlayerReady}
            className="rounded-lg border border-input px-3 py-2 text-[12px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            Play full performance
          </button>
        </div>

        <div className="border-t border-border pt-3">
          <VolumeMeter
            value={volume}
            disabled={!isPlayerReady}
            onChange={(nextVolume) => {
              const player = getPlayer();
              if (player) setPlayerVolume(player, nextVolume);
            }}
          />
        </div>

        <label className="block">
          <span className="sr-only">Seek video</span>
          <div className="relative flex h-5 items-center">
            <div className="absolute inset-x-0 h-1 rounded-full bg-secondary" aria-hidden="true" />
            <div
              className="absolute h-2 rounded-full bg-primary/70 shadow-[0_0_0_1px_oklch(0.68_0.17_25_/_0.35)]"
              style={{ left: `${clipStartPercent}%`, width: `${clipWidthPercent}%` }}
              aria-hidden="true"
            />
            <input
              type="range"
              min={0}
              max={duration}
              step={0.1}
              value={safeCurrentTime}
              onChange={(event) => seek(event.target.value)}
              disabled={!isPlayerReady}
              className="revision-scrubber relative z-10 w-full accent-primary disabled:opacity-50"
              aria-label="Seek revision video"
            />
          </div>
        </label>

        <div className="flex flex-wrap justify-between gap-2 font-mono text-[11px] text-muted-foreground">
          <span>{formatTime(safeCurrentTime)} / {formatTime(duration)}</span>
          <span className="text-primary">Highlighted cut {formatTime(clipStart)} – {formatTime(clipEnd)}</span>
        </div>
      </div>
    </section>
  );
}
