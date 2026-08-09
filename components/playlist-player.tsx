"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PlayerControls } from "@/components/player-controls";
import type { PlaylistTrack, PlaylistType } from "@/lib/types";
import { findOnlySongModeAction } from "@/lib/only-song-mode";

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

function createShuffleOrder(tracks: PlaylistTrack[], startIndex: number) {
  const remaining = tracks
    .map((_, index) => index)
    .filter((index) => index !== startIndex);
  for (let index = remaining.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [remaining[index], remaining[swapIndex]] = [remaining[swapIndex], remaining[index]];
  }
  return [startIndex, ...remaining];
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
  onlySongMode = playlistType === "videos",
  onCurrentTrackChange,
}: {
  tracks: PlaylistTrack[];
  playlistType: PlaylistType;
  selectedIndex: number | null;
  onSelectionConsumed: () => void;
  onlySongMode?: boolean;
  onCurrentTrackChange?: (track: PlaylistTrack) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const tracksRef = useRef(tracks);
  const currentIndexRef = useRef(0);
  const advanceLockRef = useRef(false);
  const previousTimeRef = useRef(0);
  const scrubbingRef = useRef(false);
  const isLoopingRef = useRef(false);
  const isShufflingRef = useRef(false);
  const shuffleOrderRef = useRef<number[] | null>(null);
  const shufflePositionRef = useRef(0);
  const loadTrackRef = useRef<(index: number, preservePlaybackOrder?: boolean) => void>(() => undefined);
  const advanceToNextRef = useRef<() => void>(() => undefined);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(tracks[0]?.clipStart ?? 0);
  const [playerState, setPlayerState] = useState<number | null>(null);
  const [isLooping, setIsLooping] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [shufflePosition, setShufflePosition] = useState(0);

  const resetShuffleOrder = useCallback((startIndex: number) => {
    shuffleOrderRef.current = createShuffleOrder(tracksRef.current, startIndex);
    shufflePositionRef.current = 0;
    setShufflePosition(0);
  }, []);

  function loadTrack(index: number, preservePlaybackOrder = false) {
    const track = tracksRef.current[index];
    if (!track || !playerRef.current) return;

    if (isShufflingRef.current && !preservePlaybackOrder) resetShuffleOrder(index);
    const previousTrack = tracksRef.current[currentIndexRef.current];
    currentIndexRef.current = index;
    setCurrentIndex(index);
    const startAt = Math.max(0, track.clipStart);
    previousTimeRef.current = startAt;
    setCurrentTime(startAt);
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
    let nextIndex: number;
    if (isShufflingRef.current) {
      if (!shuffleOrderRef.current) resetShuffleOrder(currentIndexRef.current);
      const shuffleOrder = shuffleOrderRef.current ?? [currentIndexRef.current];
      const nextPosition = shufflePositionRef.current + 1;
      if (nextPosition >= shuffleOrder.length) {
        playerRef.current?.pauseVideo();
        setPlayerState(2);
        return;
      }
      shufflePositionRef.current = nextPosition;
      setShufflePosition(nextPosition);
      nextIndex = shuffleOrder[nextPosition];
    } else {
      nextIndex = currentIndexRef.current + 1;
      if (nextIndex >= tracksRef.current.length) {
        playerRef.current?.pauseVideo();
        setPlayerState(2);
        return;
      }
    }
    loadTrack(nextIndex, true);
  }

  function advanceToPrevious() {
    if (isShufflingRef.current) {
      const shuffleOrder = shuffleOrderRef.current;
      const previousPosition = shufflePositionRef.current - 1;
      if (!shuffleOrder || previousPosition < 0) return;
      shufflePositionRef.current = previousPosition;
      setShufflePosition(previousPosition);
      loadTrack(shuffleOrder[previousPosition], true);
      return;
    }
    loadTrack(Math.max(0, currentIndexRef.current - 1));
  }

  function toggleLoop() {
    setIsLooping((current) => {
      const next = !current;
      isLoopingRef.current = next;
      return next;
    });
  }

  function toggleShuffle() {
    const next = !isShufflingRef.current;
    isShufflingRef.current = next;
    setIsShuffling(next);
    if (next) {
      resetShuffleOrder(currentIndexRef.current);
    } else {
      shuffleOrderRef.current = null;
      shufflePositionRef.current = 0;
      setShufflePosition(0);
    }
  }

  function timelineBounds(track: PlaylistTrack | undefined) {
    if (!track) return { start: 0, end: 0 };
    if (playlistType === "songs") {
      return {
        start: Math.max(0, track.clipStart),
        end: Math.max(track.clipEnd, track.clipStart + 0.5),
      };
    }
    return { start: 0, end: Math.max(0, track.clipEnd) };
  }

  function seekTo(seconds: number, allowSeekAhead: boolean) {
    const { start, end } = timelineBounds(tracksRef.current[currentIndexRef.current]);
    const nextTime = Math.min(Math.max(start, seconds), end);
    playerRef.current?.seekTo(nextTime, allowSeekAhead);
    previousTimeRef.current = nextTime;
    setCurrentTime(nextTime);
  }

  function skipBy(seconds: number) {
    seekTo(currentTime + seconds, true);
  }

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  useEffect(() => {
    loadTrackRef.current = loadTrack;
    advanceToNextRef.current = advanceToNext;
  });

  useEffect(() => {
    if (currentIndexRef.current >= tracks.length) {
      const nextIndex = Math.max(0, tracks.length - 1);
      currentIndexRef.current = nextIndex;
      setCurrentIndex(nextIndex);
    }
  }, [tracks.length]);

  useEffect(() => {
    if (isShufflingRef.current) resetShuffleOrder(currentIndexRef.current);
  }, [resetShuffleOrder, tracks.length]);

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
              const currentTime = event.target.getCurrentTime();
              previousTimeRef.current = currentTime;
              setCurrentTime(currentTime);
              setPlayerState(event.target.getPlayerState());
              setIsPlayerReady(true);
            },
            onStateChange: (event) => {
              if (cancelled) return;
              if (event.data !== PLAYER_BUFFERING) {
                const currentTime = event.target.getCurrentTime();
                previousTimeRef.current = currentTime;
                setCurrentTime(currentTime);
              }
              setPlayerState(event.data);
              if (event.data === PLAYER_ENDED) {
                if (isLoopingRef.current) loadTrackRef.current(currentIndexRef.current, true);
                else advanceToNextRef.current();
              }
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
    const track = tracks[currentIndex];
    if (track) onCurrentTrackChange?.(track);
  }, [currentIndex, onCurrentTrackChange, tracks]);

  useEffect(() => {
    if (!isPlayerReady || playerState !== PLAYER_PLAYING) return;

    const intervalId = window.setInterval(() => {
      const player = playerRef.current;
      const track = tracksRef.current[currentIndexRef.current];
      if (!player || !track || player.getPlayerState() !== PLAYER_PLAYING) return;

      const currentTime = player.getCurrentTime();
      setCurrentTime(currentTime);
      if (scrubbingRef.current) {
        previousTimeRef.current = currentTime;
        return;
      }

      if (playlistType === "songs") {
        const effectiveClipEnd = Math.max(track.clipEnd, track.clipStart + 0.5);
        const endThreshold = Math.max(track.clipStart + 0.5, effectiveClipEnd - 0.35);
        if (currentTime >= endThreshold) {
          if (isLoopingRef.current) loadTrackRef.current(currentIndexRef.current, true);
          else advanceToNextRef.current();
        }
        return;
      }

      if (!onlySongMode) return;

      const action = findOnlySongModeAction(
        track.songClips,
        previousTimeRef.current,
        currentTime,
      );
      previousTimeRef.current = currentTime;
      if (action === null) return;

      if (action.type === "stop") {
        const hasNextTrack = currentIndexRef.current + 1 < tracksRef.current.length;
        if (isLoopingRef.current) {
          loadTrackRef.current(currentIndexRef.current, true);
        } else if (hasNextTrack) {
          advanceToNextRef.current();
        } else {
          const stopAt = Math.max(0, action.end);
          player.seekTo(stopAt, true);
          player.pauseVideo();
          previousTimeRef.current = stopAt;
          setPlayerState(2);
        }
        return;
      }

      previousTimeRef.current = action.start;
      player.seekTo(action.start, true);
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [isPlayerReady, onlySongMode, playerState, playlistType]);

  if (tracks.length === 0) return null;

  const currentTrack = tracks[Math.min(currentIndex, tracks.length - 1)];
  const isPlaying = playerState === PLAYER_PLAYING;
  const isBuffering = playerState === PLAYER_BUFFERING;
  const kindLabel = playlistType === "songs" ? "Song playlist" : "Video playlist";
  const { start: timelineStart, end: timelineEnd } = timelineBounds(currentTrack);

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

      <PlayerControls
        currentTime={currentTime}
        rangeStart={timelineStart}
        rangeEnd={timelineEnd}
        isPlaying={isPlaying}
        isReady={isPlayerReady}
        onTogglePlay={() => {
          if (isPlaying) playerRef.current?.pauseVideo();
          else playerRef.current?.playVideo();
        }}
        onSeek={seekTo}
        onSkip={skipBy}
        onPrevious={advanceToPrevious}
        onNext={() => advanceToNext()}
        previousDisabled={isShuffling ? shufflePosition === 0 : currentIndex === 0}
        nextDisabled={isShuffling
          ? shufflePosition >= tracks.length - 1
          : currentIndex >= tracks.length - 1}
        isShuffling={isShuffling}
        onToggleShuffle={toggleShuffle}
        isLooping={isLooping}
        onToggleLoop={toggleLoop}
        onScrubStart={() => {
          scrubbingRef.current = true;
        }}
        onScrubEnd={() => {
          scrubbingRef.current = false;
        }}
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
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
        {playlistType === "videos"
          ? onlySongMode
            ? " Full performances skip gaps and advance after the final song."
            : " Full performances play normally from start to finish."
          : ""}
      </p>
    </section>
  );
}
