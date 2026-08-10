"use client";

import { useEffect, useRef, useState } from "react";
import { recordListeningProgress } from "@/app/listening/actions";
import { PlayerControls } from "@/components/player-controls";
import { usePlayer } from "@/components/player-context";
import { findOnlySongModeAction } from "@/lib/only-song-mode";
import { trackEvent } from "@/components/analytics";

type YouTubePlayer = {
  destroy: () => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
  loadVideoById: (videoId: string, startSeconds?: number) => void;
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
export function VideoEmbed({ videoId, duration }: { videoId: string; duration: number }) {
  const {
    songs,
    startAt,
    seekRequestId,
    currentTime,
    setStartAt,
    setCurrentTime,
    onlySongMode,
    setOnlySongMode,
  } = usePlayer();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const [initialStart] = useState(() => Math.floor(startAt));
  const previousTimeRef = useRef(initialStart);
  const trackingTimeRef = useRef<number | null>(null);
  const playedSongKeysRef = useRef(new Set<string>());
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [playerState, setPlayerState] = useState<number | null>(null);
  const safeDuration = Math.max(0, duration);

  function seekTo(seconds: number, allowSeekAhead: boolean) {
    const nextTime = Math.min(Math.max(0, seconds), safeDuration);
    playerRef.current?.seekTo(nextTime, allowSeekAhead);
    previousTimeRef.current = nextTime;
    trackingTimeRef.current = nextTime;
    setCurrentTime(nextTime);
  }

  function skipBy(seconds: number) {
    seekTo(currentTime + seconds, true);
  }

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
              const currentTime = event.target.getCurrentTime();
              previousTimeRef.current = currentTime;
              trackingTimeRef.current = currentTime;
              setCurrentTime(currentTime);
              setPlayerState(event.target.getPlayerState());
              setIsPlayerReady(true);
            },
            onStateChange: (event) => {
              if (cancelled) return;
              if (event.data === YOUTUBE_PLAYER_PLAYING) {
                const currentTime = event.target.getCurrentTime();
                const song = songs.find((item) => currentTime >= item.clipStart && currentTime < item.clipEnd);
                const songKey = `${videoId}:${song?.index ?? "performance"}`;
                if (!playedSongKeysRef.current.has(songKey)) {
                  playedSongKeysRef.current.add(songKey);
                  trackEvent({ eventName: "song_play_started", source: "video_embed", performanceVideoId: videoId, songIndex: song?.index });
                }
              }
              if (event.data !== YOUTUBE_PLAYER_BUFFERING) {
                const currentTime = event.target.getCurrentTime();
                previousTimeRef.current = currentTime;
                setCurrentTime(currentTime);
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
  }, [setCurrentTime, songs, videoId]);

  useEffect(() => {
    if (!isPlayerReady || seekRequestId === 0) return;
    previousTimeRef.current = startAt;
    trackingTimeRef.current = startAt;
    playerRef.current?.seekTo(Math.floor(startAt), true);
  }, [isPlayerReady, seekRequestId, startAt]);

  useEffect(() => {
    if (!isPlayerReady || playerState !== YOUTUBE_PLAYER_PLAYING) return;

    const intervalId = window.setInterval(() => {
      const player = playerRef.current;
      if (!player || player.getPlayerState() !== YOUTUBE_PLAYER_PLAYING) return;

      const currentTime = player.getCurrentTime();
      const previousTime = trackingTimeRef.current;
      trackingTimeRef.current = currentTime;
      if (previousTime === null) return;

      const delta = currentTime - previousTime;
      if (delta > 0 && delta <= 30) void recordListeningProgress(videoId, delta);
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [isPlayerReady, playerState, videoId]);

  useEffect(() => {
    if (!isPlayerReady || playerState !== YOUTUBE_PLAYER_PLAYING) return;

    const intervalId = window.setInterval(() => {
      const player = playerRef.current;
      if (!player || player.getPlayerState() !== YOUTUBE_PLAYER_PLAYING) return;
      setCurrentTime(player.getCurrentTime());
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [isPlayerReady, playerState, setCurrentTime]);

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
      const action = findOnlySongModeAction(
        songs,
        previousTimeRef.current,
        currentTime,
      );
      previousTimeRef.current = currentTime;

      if (action === null) return;

      if (action.type === "stop") {
        const stopAt = Math.max(0, action.end);
        player.seekTo(stopAt, true);
        player.pauseVideo();
        previousTimeRef.current = stopAt;
        setStartAt(stopAt);
        return;
      }

      previousTimeRef.current = action.start;
      setStartAt(action.start);
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

      <PlayerControls
        currentTime={currentTime}
        rangeStart={0}
        rangeEnd={safeDuration}
        isPlaying={playerState === YOUTUBE_PLAYER_PLAYING}
        isReady={isPlayerReady}
        onTogglePlay={() => {
          if (playerState === YOUTUBE_PLAYER_PLAYING) playerRef.current?.pauseVideo();
          else playerRef.current?.playVideo();
        }}
        onSeek={seekTo}
        onSkip={skipBy}
      />
    </div>
  );
}
