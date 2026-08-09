"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { recordListeningProgress } from "@/app/listening/actions";
import { PersistentPlayerDock } from "@/components/persistent-player";
import { findOnlySongModeAction } from "@/lib/only-song-mode";
import type { Song } from "@/lib/types";

type YouTubePlayer = {
  destroy: () => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
  cueVideoById?: (videoId: string, startSeconds?: number) => void;
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

export type PlaybackSource = {
  videoId: string;
  title: string;
  duration: number;
  songs: Song[];
  initialStart: number;
};

const PLAYER_PLAYING = 1;
const PLAYER_BUFFERING = 3;
const PLAYER_UNSTARTED = -1;
let iframeApiPromise: Promise<void> | null = null;

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

type PlayerContextValue = {
  startAt: number;
  setStartAt: (seconds: number) => void;
  seekRequestId: number;
  currentTime: number;
  setCurrentTime: (seconds: number) => void;
  songs: Song[];
  onlySongMode: boolean;
  setOnlySongMode: (enabled: boolean) => void;
  videoId: string | null;
  title: string;
  duration: number;
  isPlaying: boolean;
  isReady: boolean;
  isBuffering: boolean;
  activateVideo: (source: PlaybackSource) => void;
  attachPlayerHost: (host: HTMLElement | null) => void;
  togglePlay: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  skipBy: (seconds: number) => void;
  closePlayer: () => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [source, setSource] = useState<PlaybackSource | null>(null);
  const sourceRef = useRef<PlaybackSource | null>(null);
  const [startAt, setStartAtState] = useState(0);
  const [seekRequestId, setSeekRequestId] = useState(0);
  const [currentTime, setCurrentTimeState] = useState(0);
  const currentTimeRef = useRef(0);
  const [onlySongMode, setOnlySongMode] = useState(false);
  const [playerState, setPlayerState] = useState<number | null>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [isFullAttached, setIsFullAttached] = useState(false);

  const miniHostRef = useRef<HTMLDivElement>(null);
  const fullHostRef = useRef<HTMLElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const playerCreationRef = useRef<Promise<void> | null>(null);
  const previousTimeRef = useRef(0);
  const trackingTimeRef = useRef<number | null>(null);

  const setCurrentTime = useCallback((seconds: number) => {
    currentTimeRef.current = seconds;
    setCurrentTimeState(seconds);
  }, []);

  const movePlayerToCurrentHost = useCallback(() => {
    const iframe = iframeRef.current;
    const host = fullHostRef.current ?? miniHostRef.current;
    if (iframe && host && iframe.parentElement !== host) host.append(iframe);
  }, []);

  const attachPlayerHost = useCallback(
    (host: HTMLElement | null) => {
      fullHostRef.current = host;
      setIsFullAttached(Boolean(host));
      movePlayerToCurrentHost();
    },
    [movePlayerToCurrentHost],
  );

  const seekTo = useCallback(
    (seconds: number, allowSeekAhead: boolean) => {
      const activeSource = sourceRef.current;
      if (!activeSource) return;
      const nextTime = clamp(seconds, 0, Math.max(0, activeSource.duration));
      playerRef.current?.seekTo(nextTime, allowSeekAhead);
      previousTimeRef.current = nextTime;
      trackingTimeRef.current = nextTime;
      setStartAtState(nextTime);
      setCurrentTime(nextTime);
    },
    [setCurrentTime],
  );

  const setStartAt = useCallback(
    (seconds: number) => {
      setSeekRequestId((requestId) => requestId + 1);
      seekTo(seconds, true);
    },
    [seekTo],
  );

  const skipBy = useCallback(
    (seconds: number) => {
      seekTo(currentTimeRef.current + seconds, true);
    },
    [seekTo],
  );

  const activateVideo = useCallback(
    (nextSource: PlaybackSource) => {
      const normalizedSource = {
        ...nextSource,
        duration: Math.max(0, nextSource.duration),
        initialStart: Math.max(0, nextSource.initialStart),
      };
      const previousSource = sourceRef.current;
      const isSameVideo = previousSource?.videoId === normalizedSource.videoId;

      sourceRef.current = normalizedSource;
      setSource(normalizedSource);

      if (isSameVideo) return;

      const initialTime = clamp(
        normalizedSource.initialStart,
        0,
        normalizedSource.duration,
      );
      setOnlySongMode(false);
      setStartAtState(initialTime);
      setCurrentTime(initialTime);
      setPlayerState(null);
      previousTimeRef.current = initialTime;
      trackingTimeRef.current = initialTime;

      const player = playerRef.current;
      if (player) {
        if (player.cueVideoById) {
          player.cueVideoById(normalizedSource.videoId, initialTime);
        } else {
          player.loadVideoById(normalizedSource.videoId, initialTime);
          player.pauseVideo();
        }
      } else if (iframeRef.current) {
        iframeRef.current.src = `https://www.youtube-nocookie.com/embed/${normalizedSource.videoId}?enablejsapi=1&start=${Math.floor(initialTime)}&rel=0`;
      }
    },
    [setCurrentTime],
  );

  const closePlayer = useCallback(() => {
    playerRef.current?.destroy();
    playerRef.current = null;
    iframeRef.current?.remove();
    iframeRef.current = null;
    sourceRef.current = null;
    setSource(null);
    setPlayerState(null);
    setIsPlayerReady(false);
    setStartAtState(0);
    setCurrentTime(0);
  }, [setCurrentTime]);

  const ensurePlayer = useCallback(() => {
    if (playerRef.current || playerCreationRef.current || iframeRef.current || !sourceRef.current) return;

    const activeSource = sourceRef.current;
    const host = fullHostRef.current ?? miniHostRef.current;
    if (!host) return;

    const iframe = document.createElement("iframe");
    iframe.className = "absolute inset-0 h-full w-full border-0";
    iframe.src = `https://www.youtube-nocookie.com/embed/${activeSource.videoId}?enablejsapi=1&start=${Math.floor(activeSource.initialStart)}&rel=0`;
    iframe.title = `${activeSource.title} Tiny Desk Concert`;
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    iframe.allowFullscreen = true;
    host.append(iframe);
    iframeRef.current = iframe;

    const creation = loadYouTubeIframeApi()
      .then(() => {
        const currentSource = sourceRef.current;
        if (!currentSource || !iframeRef.current || !window.YT?.Player) return;

        const player = new window.YT.Player(iframeRef.current, {
          events: {
            onReady: (event) => {
              playerRef.current = event.target;
              const reportedTime = event.target.getCurrentTime();
              const readyTime = reportedTime > 0
                ? reportedTime
                : sourceRef.current?.initialStart ?? 0;
              previousTimeRef.current = readyTime;
              trackingTimeRef.current = readyTime;
              setCurrentTime(readyTime);
              setPlayerState(event.target.getPlayerState());
              setIsPlayerReady(true);
            },
            onStateChange: (event) => {
              const nextTime = event.target.getCurrentTime();
              if (event.data !== PLAYER_BUFFERING && event.data !== PLAYER_UNSTARTED) {
                previousTimeRef.current = nextTime;
                setCurrentTime(nextTime);
              }
              setPlayerState(event.data);
            },
          },
        });
        playerRef.current = player;
      })
      .catch(() => {
        // The iframe still has its native YouTube controls if the API fails.
      })
      .finally(() => {
        playerCreationRef.current = null;
      });

    playerCreationRef.current = creation;
  }, [setCurrentTime]);

  useEffect(() => {
    if (!source) return;
    ensurePlayer();
  }, [ensurePlayer, isFullAttached, source]);

  useEffect(() => {
    if (!source || !isPlayerReady || playerState !== PLAYER_PLAYING) return;

    const intervalId = window.setInterval(() => {
      const player = playerRef.current;
      if (!player || player.getPlayerState() !== PLAYER_PLAYING) return;

      const nextTime = player.getCurrentTime();
      setCurrentTime(nextTime);
      const previousTime = trackingTimeRef.current;
      trackingTimeRef.current = nextTime;
      if (previousTime === null) return;

      const delta = nextTime - previousTime;
      if (delta > 0 && delta <= 30) {
        void recordListeningProgress(source.videoId, delta);
      }
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [isPlayerReady, playerState, setCurrentTime, source]);

  useEffect(() => {
    if (!source || !isPlayerReady || playerState !== PLAYER_PLAYING) return;

    const intervalId = window.setInterval(() => {
      const player = playerRef.current;
      if (!player || player.getPlayerState() !== PLAYER_PLAYING) return;
      setCurrentTime(player.getCurrentTime());
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [isPlayerReady, playerState, setCurrentTime, source]);

  useEffect(() => {
    if (!source || !isPlayerReady || !onlySongMode || playerState !== PLAYER_PLAYING) return;

    const intervalId = window.setInterval(() => {
      const player = playerRef.current;
      if (!player || player.getPlayerState() !== PLAYER_PLAYING) return;

      const nextTime = player.getCurrentTime();
      const action = findOnlySongModeAction(source.songs, previousTimeRef.current, nextTime);
      previousTimeRef.current = nextTime;
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
  }, [isPlayerReady, onlySongMode, playerState, setStartAt, source]);

  const togglePlay = useCallback(() => {
    if (!playerRef.current || !isPlayerReady) return;
    if (playerState === PLAYER_PLAYING) playerRef.current.pauseVideo();
    else playerRef.current.playVideo();
  }, [isPlayerReady, playerState]);

  const contextValue: PlayerContextValue = {
    startAt,
    setStartAt,
    seekRequestId,
    currentTime,
    setCurrentTime,
    songs: source?.songs ?? [],
    onlySongMode,
    setOnlySongMode,
    videoId: source?.videoId ?? null,
    title: source?.title ?? "",
    duration: source?.duration ?? 0,
    isPlaying: playerState === PLAYER_PLAYING,
    isReady: isPlayerReady,
    isBuffering: playerState === PLAYER_BUFFERING,
    activateVideo,
    attachPlayerHost,
    togglePlay,
    seekTo,
    skipBy,
    closePlayer,
  };

  return (
    <PlayerContext.Provider value={contextValue}>
      {children}
      <PersistentPlayerDock
        videoId={source?.videoId ?? null}
        title={source?.title ?? ""}
        currentTime={currentTime}
        duration={source?.duration ?? 0}
        isPlaying={playerState === PLAYER_PLAYING}
        isReady={isPlayerReady}
        isBuffering={playerState === PLAYER_BUFFERING}
        isFullAttached={isFullAttached}
        miniHostRef={miniHostRef}
        onTogglePlay={togglePlay}
        onSeek={seekTo}
        onSkip={skipBy}
        onClose={closePlayer}
      />
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within a PlayerProvider");
  return ctx;
}
