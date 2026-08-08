"use client";

import { useEffect, useRef, useState } from "react";
import { formatTime } from "@/lib/format";

type YouTubePlayer = {
  destroy: () => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
  pauseVideo: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
};

type YouTubePlayerEvent = { target: YouTubePlayer };
type YouTubeStateChangeEvent = { data: number; target: YouTubePlayer };

type YouTubeApi = {
  Player: new (
    element: HTMLIFrameElement,
    options: {
      events: {
        onReady: (event: YouTubePlayerEvent) => void;
        onStateChange: (event: YouTubeStateChangeEvent) => void;
      };
    },
  ) => YouTubePlayer;
};

type YouTubeWindow = Window & {
  YT?: YouTubeApi;
  onYouTubeIframeAPIReady?: () => void;
};

function youtubeWindow() {
  return window as YouTubeWindow;
}

let iframeApiPromise: Promise<void> | null = null;
const YOUTUBE_PLAYER_PLAYING = 1;

function loadYouTubeIframeApi() {
  const currentWindow = youtubeWindow();
  if (currentWindow.YT?.Player) return Promise.resolve();
  if (iframeApiPromise) return iframeApiPromise;

  iframeApiPromise = new Promise((resolve, reject) => {
    const previousReady = currentWindow.onYouTubeIframeAPIReady;
    currentWindow.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      resolve();
    };

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => {
      iframeApiPromise = null;
      reject(new Error("Unable to load the YouTube IFrame Player API."));
    };
    document.head.append(script);
  });

  return iframeApiPromise;
}

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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const initialClipStartRef = useRef(clipStart);
  const stopAtRef = useRef<number | null>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [playerState, setPlayerState] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(clipStart);

  useEffect(() => {
    let cancelled = false;

    void loadYouTubeIframeApi()
      .then(() => {
        const currentWindow = youtubeWindow();
        const youtubeApi = currentWindow.YT;
        if (cancelled || !iframeRef.current || !youtubeApi?.Player) return;

        const player = new youtubeApi.Player(iframeRef.current, {
          events: {
            onReady: (event) => {
              if (cancelled) return;
              playerRef.current = event.target;
              event.target.seekTo(initialClipStartRef.current, true);
              setCurrentTime(initialClipStartRef.current);
              setPlayerState(event.target.getPlayerState());
              setIsPlayerReady(true);
            },
            onStateChange: (event) => {
              if (cancelled) return;
              setPlayerState(event.data);
            },
          },
        });

        playerRef.current = player;
      })
      .catch(() => {
        // The native YouTube controls remain available if the API is unavailable.
      });

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
    // The iframe is mounted once; song changes seek the same player below.
  }, []);

  useEffect(() => {
    if (!isPlayerReady) return;
    stopAtRef.current = null;
    playerRef.current?.seekTo(clipStart, true);
    playerRef.current?.pauseVideo();
    setCurrentTime(clipStart);
    setPlayerState(2);
  }, [clipStart, isPlayerReady, songKey]);

  useEffect(() => {
    if (!isPlayerReady) return;

    const intervalId = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) return;

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
    if (!playerRef.current) return;
    stopAtRef.current = clipEnd;
    playerRef.current.seekTo(clipStart, true);
    playerRef.current.playVideo();
    setCurrentTime(clipStart);
  }

  function playFullPerformance() {
    if (!playerRef.current) return;
    stopAtRef.current = null;
    playerRef.current.seekTo(0, true);
    playerRef.current.playVideo();
    setCurrentTime(0);
  }

  function pause() {
    stopAtRef.current = null;
    playerRef.current?.pauseVideo();
    setPlayerState(2);
  }

  function seek(value: string) {
    const nextTime = Number(value);
    if (!Number.isFinite(nextTime)) return;
    playerRef.current?.seekTo(nextTime, true);
    setCurrentTime(nextTime);
  }

  const safeCurrentTime = Math.max(0, Math.min(duration, currentTime));

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
        <iframe
          ref={iframeRef}
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&start=${Math.floor(clipStart)}&rel=0&modestbranding=1`}
          title={`${songTitle} revision playback`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
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

        <label className="block">
          <span className="sr-only">Seek video</span>
          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={safeCurrentTime}
            onChange={(event) => seek(event.target.value)}
            disabled={!isPlayerReady}
            className="w-full accent-primary disabled:opacity-50"
            aria-label="Seek revision video"
          />
        </label>

        <div className="flex flex-wrap justify-between gap-2 font-mono text-[11px] text-muted-foreground">
          <span>{formatTime(safeCurrentTime)} / {formatTime(duration)}</span>
          <span className="text-primary">Clip {formatTime(clipStart)} – {formatTime(clipEnd)}</span>
        </div>
      </div>
    </section>
  );
}
