"use client";

import { useEffect, useRef, useState } from "react";
import { usePlayer } from "@/components/player-context";
import { findOnlySongModeTarget } from "@/lib/only-song-mode";

type YouTubePlayer = {
  destroy: () => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
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

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let iframeApiPromise: Promise<void> | null = null;
const YOUTUBE_PLAYER_PLAYING = 1;
const YOUTUBE_PLAYER_BUFFERING = 3;

function loadYouTubeIframeApi() {
  if (window.YT?.Player) return Promise.resolve();
  if (iframeApiPromise) return iframeApiPromise;

  iframeApiPromise = new Promise((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
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

/**
 * A stable YouTube iframe that the IFrame Player API seeks in place. Calling
 * `seekTo` preserves YouTube's existing paused or playing state, so clicking
 * a song never replaces the player or asks the viewer to start again.
 */
export function VideoEmbed({ videoId }: { videoId: string }) {
  const {
    songs,
    startAt,
    setStartAt,
    onlySongMode,
    setOnlySongMode,
  } = usePlayer();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const [initialStart] = useState(() => Math.floor(startAt));
  const previousTimeRef = useRef(initialStart);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [playerState, setPlayerState] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    void loadYouTubeIframeApi()
      .then(() => {
        if (cancelled || !iframeRef.current || !window.YT?.Player) return;

        const player = new window.YT.Player(iframeRef.current, {
          events: {
            onReady: (event) => {
              if (cancelled) return;
              playerRef.current = event.target;
              previousTimeRef.current = event.target.getCurrentTime();
              setPlayerState(event.target.getPlayerState());
              setIsPlayerReady(true);
            },
            onStateChange: (event) => {
              if (cancelled) return;
              if (event.data !== YOUTUBE_PLAYER_BUFFERING) {
                previousTimeRef.current = event.target.getCurrentTime();
              }
              setPlayerState(event.data);
            },
          },
        });

        playerRef.current = player;
      })
      .catch(() => {
        // Native YouTube controls remain available if the API is unavailable.
      });

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isPlayerReady || startAt === initialStart) return;
    previousTimeRef.current = startAt;
    playerRef.current?.seekTo(Math.floor(startAt), true);
  }, [initialStart, isPlayerReady, startAt]);

  useEffect(() => {
    if (!isPlayerReady) return;
    previousTimeRef.current = playerRef.current?.getCurrentTime() ?? previousTimeRef.current;
  }, [isPlayerReady, onlySongMode]);

  useEffect(() => {
    if (!isPlayerReady || !onlySongMode || playerState !== YOUTUBE_PLAYER_PLAYING) return;

    const intervalId = window.setInterval(() => {
      const player = playerRef.current;
      if (!player || player.getPlayerState() !== YOUTUBE_PLAYER_PLAYING) return;

      const currentTime = player.getCurrentTime();
      const nextStart = findOnlySongModeTarget(
        songs,
        previousTimeRef.current,
        currentTime,
      );
      previousTimeRef.current = currentTime;

      if (nextStart === null) return;

      previousTimeRef.current = nextStart;
      setStartAt(nextStart);
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [isPlayerReady, onlySongMode, playerState, setStartAt, songs]);

  return (
    <div className="mb-4">
      <div className="flex items-center justify-end mb-2">
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

      <div className="relative aspect-video rounded-[10px] overflow-hidden border border-border bg-black">
        <iframe
          ref={iframeRef}
          className="absolute inset-0 w-full h-full"
          src={`https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&start=${initialStart}&rel=0`}
          title="Tiny Desk Concert"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
}
