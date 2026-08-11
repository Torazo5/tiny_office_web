"use client";

import { useEffect, useRef, useState } from "react";
import { recordListeningProgress } from "@/app/listening/actions";
import { PlayerControls } from "@/components/player-controls";
import { PlaybackCustomizer } from "@/components/playback-customizer";
import { usePlayer } from "@/components/player-context";
import { findOnlySongModeAction } from "@/lib/only-song-mode";
import { trackEvent } from "@/components/analytics";
import {
  createYouTubePlayer,
  isYouTubePlayer,
  loadYouTubeIframeApi,
  type YouTubePlayer,
} from "@/lib/youtube-iframe-api";

const YOUTUBE_PLAYER_PLAYING = 1;
const YOUTUBE_PLAYER_BUFFERING = 3;

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
    playbackSettings,
    setPlaybackSettings,
    isSignedIn,
  } = usePlayer();
  const playerHostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const songsRef = useRef(songs);
  const videoIdRef = useRef(videoId);
  const [initialStart] = useState(() => Math.floor(startAt));
  const previousTimeRef = useRef(initialStart);
  const trackingTimeRef = useRef<number | null>(null);
  const playedSongKeysRef = useRef(new Set<string>());
  const transitionTimerRef = useRef<number | null>(null);
  const fadeTimerRef = useRef<number | null>(null);
  const isTransitioningRef = useRef(false);
  const transitionToSongRef = useRef<(nextStart: number) => void>(() => undefined);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [playerState, setPlayerState] = useState<number | null>(null);
  const safeDuration = Math.max(0, duration);

  useEffect(() => {
    songsRef.current = songs;
    videoIdRef.current = videoId;
  }, [songs, videoId]);

  function getPlayer() {
    const player = playerRef.current;
    return isYouTubePlayer(player) ? player : null;
  }

  function seekTo(seconds: number, allowSeekAhead: boolean) {
    const nextTime = Math.min(Math.max(0, seconds), safeDuration);
    getPlayer()?.seekTo(nextTime, allowSeekAhead);
    previousTimeRef.current = nextTime;
    trackingTimeRef.current = nextTime;
    setCurrentTime(nextTime);
  }

  function skipBy(seconds: number) {
    seekTo(currentTime + seconds, true);
  }

  function clearTransition() {
    if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current);
    if (fadeTimerRef.current !== null) window.clearInterval(fadeTimerRef.current);
    transitionTimerRef.current = null;
    fadeTimerRef.current = null;
    isTransitioningRef.current = false;
  }

  function fade(player: YouTubePlayer, from: number, to: number, seconds: number, onComplete: () => void) {
    if (seconds <= 0) {
      player.setVolume(to);
      onComplete();
      return;
    }
    const startedAt = performance.now();
    const tick = () => {
      const activePlayer = getPlayer();
      if (!activePlayer) return clearTransition();
      const progress = Math.min(1, (performance.now() - startedAt) / (seconds * 1000));
      activePlayer.setVolume(Math.round(from + (to - from) * progress));
      if (progress >= 1) {
        if (fadeTimerRef.current !== null) window.clearInterval(fadeTimerRef.current);
        fadeTimerRef.current = null;
        onComplete();
      }
    };
    tick();
    fadeTimerRef.current = window.setInterval(tick, 50);
  }

  function transitionToSong(nextStart: number) {
    const player = getPlayer();
    if (!player || isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    const volume = Math.min(100, Math.max(0, player.getVolume()));
    fade(player, volume, 0, playbackSettings.fadeOutSeconds, () => {
      player.pauseVideo();
      transitionTimerRef.current = window.setTimeout(() => {
        const activePlayer = getPlayer();
        if (!activePlayer) return clearTransition();
        activePlayer.seekTo(nextStart, true);
        activePlayer.playVideo();
        previousTimeRef.current = nextStart;
        setStartAt(nextStart);
        fade(activePlayer, 0, volume, playbackSettings.fadeInSeconds, clearTransition);
      }, playbackSettings.gapSeconds * 1000);
    });
  }

  useEffect(() => {
    transitionToSongRef.current = transitionToSong;
  });

  useEffect(() => {
    let cancelled = false;

    void loadYouTubeIframeApi()
      .then((api) => {
        if (cancelled || !playerHostRef.current) return;

        const player = createYouTubePlayer(api, playerHostRef.current, videoIdRef.current, {
          onReady: (event) => {
            if (cancelled || !isYouTubePlayer(event.target)) return;
            playerRef.current = event.target;
            const currentTime = event.target.getCurrentTime();
            previousTimeRef.current = currentTime;
            trackingTimeRef.current = currentTime;
            setCurrentTime(currentTime);
            setPlayerState(event.target.getPlayerState());
            setIsPlayerReady(true);
          },
          onStateChange: (event) => {
            if (cancelled || !isYouTubePlayer(event.target)) return;
            const player = event.target;
            if (event.data === YOUTUBE_PLAYER_PLAYING) {
              const currentTime = player.getCurrentTime();
              const song = songsRef.current.find((item) => currentTime >= item.clipStart && currentTime < item.clipEnd);
              const songKey = `${videoIdRef.current}:${song?.index ?? "performance"}`;
              if (!playedSongKeysRef.current.has(songKey)) {
                playedSongKeysRef.current.add(songKey);
                trackEvent({ eventName: "song_play_started", source: "video_embed", performanceVideoId: videoIdRef.current, songIndex: song?.index });
              }
            }
            if (event.data !== YOUTUBE_PLAYER_BUFFERING) {
              const currentTime = player.getCurrentTime();
              previousTimeRef.current = currentTime;
              setCurrentTime(currentTime);
            }
            setPlayerState(event.data);
          },
        }, initialStart);

        if (player) playerRef.current = player;
      })
      .catch(() => {
        // Native YouTube controls remain available if the API is unavailable.
      });

    return () => {
      cancelled = true;
      clearTransition();
      const player = playerRef.current;
      if (isYouTubePlayer(player)) player.destroy();
      playerRef.current = null;
    };
  }, [initialStart, setCurrentTime]);

  useEffect(() => {
    if (!isPlayerReady || seekRequestId === 0) return;
    previousTimeRef.current = startAt;
    trackingTimeRef.current = startAt;
    const player = playerRef.current;
    if (isYouTubePlayer(player)) player.seekTo(Math.floor(startAt), true);
  }, [isPlayerReady, seekRequestId, startAt]);

  useEffect(() => {
    if (!isPlayerReady || playerState !== YOUTUBE_PLAYER_PLAYING) return;

    const intervalId = window.setInterval(() => {
      const player = playerRef.current;
      if (!isYouTubePlayer(player) || player.getPlayerState() !== YOUTUBE_PLAYER_PLAYING) return;

      const currentTime = player.getCurrentTime();
      const previousTime = trackingTimeRef.current;
      trackingTimeRef.current = currentTime;
      if (previousTime === null) return;

      const delta = currentTime - previousTime;
      if (delta > 0 && delta <= 30) {
        void recordListeningProgress(videoIdRef.current, delta).catch(() => undefined);
      }
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [isPlayerReady, playerState, videoId]);

  useEffect(() => {
    if (!isPlayerReady || playerState !== YOUTUBE_PLAYER_PLAYING) return;

    const intervalId = window.setInterval(() => {
      const player = playerRef.current;
      if (!isYouTubePlayer(player) || player.getPlayerState() !== YOUTUBE_PLAYER_PLAYING) return;
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
      if (!isYouTubePlayer(player) || player.getPlayerState() !== YOUTUBE_PLAYER_PLAYING) return;

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
      transitionToSongRef.current(action.start);
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [isPlayerReady, onlySongMode, playerState, playbackSettings, setStartAt, songs]);

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
        <div ref={playerHostRef} className="absolute inset-0 h-full w-full" aria-label="Tiny Desk Concert" />
      </div>

      {onlySongMode && (
        <PlaybackCustomizer
          settings={playbackSettings}
          onSettingsChange={setPlaybackSettings}
          isSignedIn={isSignedIn}
        />
      )}

      <PlayerControls
        currentTime={currentTime}
        rangeStart={0}
        rangeEnd={safeDuration}
        isPlaying={playerState === YOUTUBE_PLAYER_PLAYING}
        isReady={isPlayerReady}
        onTogglePlay={() => {
          const player = getPlayer();
          if (!player) return;
          if (playerState === YOUTUBE_PLAYER_PLAYING) player.pauseVideo();
          else player.playVideo();
        }}
        onSeek={seekTo}
        onSkip={skipBy}
      />
    </div>
  );
}
