"use client";

import { useEffect, useRef, useState } from "react";
import type { PlaylistTrack, PlaylistType } from "@/lib/types";

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

type YouTubeWindow = Window & {
  YT?: YouTubeApi;
  onYouTubeIframeAPIReady?: () => void;
};

const PLAYER_ENDED = 0;
const PLAYER_PLAYING = 1;
const PLAYER_BUFFERING = 3;
let iframeApiPromise: Promise<void> | null = null;

function youtubeWindow() {
  return window as YouTubeWindow;
}

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

export function PlaylistPlayer({
  tracks,
  playlistType,
  selectedIndex,
  onSelectionConsumed,
}: {
  tracks: PlaylistTrack[];
  playlistType: PlaylistType;
  selectedIndex: number | null;
  onSelectionConsumed: () => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const tracksRef = useRef(tracks);
  const currentIndexRef = useRef(0);
  const advanceLockRef = useRef(false);
  const loadTrackRef = useRef<(index: number) => void>(() => undefined);
  const advanceToNextRef = useRef<() => void>(() => undefined);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playerState, setPlayerState] = useState<number | null>(null);

  tracksRef.current = tracks;

  function loadTrack(index: number) {
    const track = tracksRef.current[index];
    if (!track || !playerRef.current) return;

    const previousTrack = tracksRef.current[currentIndexRef.current];
    currentIndexRef.current = index;
    setCurrentIndex(index);
    advanceLockRef.current = true;
    if (previousTrack?.performanceVideoId === track.performanceVideoId) {
      playerRef.current.seekTo(Math.max(0, track.clipStart), true);
      playerRef.current.playVideo();
    } else {
      playerRef.current.loadVideoById(track.performanceVideoId, Math.max(0, track.clipStart));
    }
    window.setTimeout(() => {
      advanceLockRef.current = false;
    }, 800);
  }

  function advanceToNext() {
    if (advanceLockRef.current) return;
    const nextIndex = currentIndexRef.current + 1;
    if (nextIndex >= tracksRef.current.length) {
      playerRef.current?.pauseVideo();
      setPlayerState(2);
      return;
    }
    loadTrack(nextIndex);
  }

  loadTrackRef.current = loadTrack;
  advanceToNextRef.current = advanceToNext;

  useEffect(() => {
    if (currentIndexRef.current >= tracks.length) {
      const nextIndex = Math.max(0, tracks.length - 1);
      currentIndexRef.current = nextIndex;
      setCurrentIndex(nextIndex);
    }
  }, [tracks.length]);

  useEffect(() => {
    let cancelled = false;

    if (!tracksRef.current[0] || !iframeRef.current) return;

    void loadYouTubeIframeApi()
      .then(() => {
        const currentWindow = youtubeWindow();
        if (cancelled || !iframeRef.current || !currentWindow.YT?.Player) return;

        const player = new currentWindow.YT.Player(iframeRef.current, {
          events: {
            onReady: (event) => {
              if (cancelled) return;
              playerRef.current = event.target;
              setPlayerState(event.target.getPlayerState());
              setIsPlayerReady(true);
            },
            onStateChange: (event) => {
              if (cancelled) return;
              setPlayerState(event.data);
              if (event.data === PLAYER_ENDED) advanceToNextRef.current();
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
    // The player is intentionally mounted once. Track changes are handled by refs
    // so adding/removing items does not reset the current YouTube iframe.
  }, []);

  useEffect(() => {
    if (selectedIndex === null || !isPlayerReady) return;
    loadTrackRef.current(selectedIndex);
    onSelectionConsumed();
  }, [isPlayerReady, onSelectionConsumed, selectedIndex]);

  useEffect(() => {
    if (!isPlayerReady || playerState !== PLAYER_PLAYING || playlistType !== "songs") return;

    const intervalId = window.setInterval(() => {
      const player = playerRef.current;
      const track = tracksRef.current[currentIndexRef.current];
      if (!player || !track || player.getPlayerState() !== PLAYER_PLAYING) return;

      const currentTime = player.getCurrentTime();
      const effectiveClipEnd = Math.max(track.clipEnd, track.clipStart + 0.5);
      const endThreshold = Math.max(track.clipStart + 0.5, effectiveClipEnd - 0.35);
      if (currentTime >= endThreshold) advanceToNextRef.current();
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [isPlayerReady, playerState, playlistType]);

  if (tracks.length === 0) return null;

  const currentTrack = tracks[Math.min(currentIndex, tracks.length - 1)];
  const isPlaying = playerState === PLAYER_PLAYING;
  const isBuffering = playerState === PLAYER_BUFFERING;
  const kindLabel = playlistType === "songs" ? "Song playlist" : "Video playlist";

  return (
    <section className="mb-8 rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="relative aspect-video overflow-hidden rounded-lg border border-border bg-black">
        <iframe
          ref={iframeRef}
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${tracks[0].performanceVideoId}?enablejsapi=1&start=${Math.floor(tracks[0].clipStart)}&rel=0`}
          title="Playlist player"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (!isPlayerReady) return;
            if (isPlaying) playerRef.current?.pauseVideo();
            else playerRef.current?.playVideo();
          }}
          disabled={!isPlayerReady}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
          aria-label={isPlaying ? "Pause playlist" : "Play playlist"}
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
        <button
          type="button"
          onClick={() => loadTrack(Math.max(0, currentIndex - 1))}
          disabled={!isPlayerReady || currentIndex === 0}
          className="rounded-md border border-input px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground disabled:cursor-default disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => advanceToNext()}
          disabled={!isPlayerReady || currentIndex >= tracks.length - 1}
          className="rounded-md border border-input px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground disabled:cursor-default disabled:opacity-40"
        >
          Next
        </button>
        <div className="min-w-0 flex-1 sm:ml-2">
          <div className="truncate text-[13.5px] font-semibold text-foreground">{currentTrack.title}</div>
          <div className="truncate text-[12px] text-muted-foreground">
            {playlistType === "songs" ? currentTrack.artist : "Full Tiny Desk performance"} · {kindLabel}
          </div>
        </div>
        <span className="font-mono text-[11px] text-muted-foreground">
          {isBuffering ? "Loading…" : `${currentIndex + 1} / ${tracks.length}`}
        </span>
      </div>
      <p className="mt-3 text-[12px] text-muted-foreground/75">
        One player stays mounted while the next {playlistType === "songs" ? "song clip" : "performance"} loads in place.
      </p>
    </section>
  );
}
