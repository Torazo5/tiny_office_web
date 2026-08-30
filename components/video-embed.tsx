"use client";

import { useEffect, useRef, useState } from "react";
import { Music2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { recordListeningProgress } from "@/app/listening/actions";
import { PlayerControls } from "@/components/player-controls";
import { PlaybackCustomizer } from "@/components/playback-customizer";
import { usePlayer } from "@/components/player-context";
import { findOnlySongModeAction } from "@/lib/only-song-mode";
import { chooseAutoplayVideoId } from "@/lib/autoplay";
import {
  equalPowerFadeGain,
  fadeDurationFromCurrentTime,
  getBuiltInFadeWindow,
  specialFadeOutGain,
  type FadeWindow,
} from "@/lib/playback-fade";
import { trackEvent } from "@/components/analytics";
import {
  createYouTubePlayer,
  isYouTubePlayer,
  loadYouTubeIframeApi,
  type YouTubePlayer,
} from "@/lib/youtube-iframe-api";

const YOUTUBE_PLAYER_PLAYING = 1;
const YOUTUBE_PLAYER_BUFFERING = 3;
const YOUTUBE_PLAYER_ENDED = 0;

/**
 * A stable YouTube iframe that the IFrame Player API seeks in place. Calling
 * `seekTo` preserves YouTube's existing paused or playing state, so clicking
 * a song never replaces the player or asks the viewer to start again.
 */
export function VideoEmbed({
  videoId,
  duration,
  autoplayVideoIds,
  shouldAutoplay,
}: {
  videoId: string;
  duration: number;
  autoplayVideoIds: string[];
  shouldAutoplay: boolean;
}) {
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
  const router = useRouter();
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
  const isAutoplayNavigatingRef = useRef(false);
  const volumeRef = useRef(100);
  const transitionToSongRef = useRef<(nextStart: number, fadeWindow?: FadeWindow | null, fallbackFadeSeconds?: number) => void>(() => undefined);
  const fadeOutAndStopRef = useRef<(end: number, fadeWindow?: FadeWindow | null, fallbackFadeSeconds?: number, onStopped?: () => void) => void>(() => undefined);
  const onlySongModeRef = useRef(onlySongMode);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [playerState, setPlayerState] = useState<number | null>(null);
  const [volume, setVolume] = useState(100);
  const safeDuration = Math.max(0, duration);

  useEffect(() => {
    songsRef.current = songs;
    videoIdRef.current = videoId;
  }, [songs, videoId]);

  useEffect(() => {
    onlySongModeRef.current = onlySongMode;
  }, [onlySongMode]);

  function getPlayer() {
    const player = playerRef.current;
    return isYouTubePlayer(player) ? player : null;
  }

  function playAnotherVideo() {
    if (isAutoplayNavigatingRef.current) return;
    const nextVideoId = chooseAutoplayVideoId(autoplayVideoIds, videoIdRef.current);
    if (!nextVideoId) return;

    isAutoplayNavigatingRef.current = true;
    const query = new URLSearchParams({ autoplay: "1" });
    if (onlySongModeRef.current) query.set("only_songs", "1");
    router.push(`/video/${encodeURIComponent(nextVideoId)}?${query.toString()}`);
  }

  function setPlayerVolume(player: YouTubePlayer, nextVolume: number) {
    const normalizedVolume = Math.min(100, Math.max(0, Math.round(nextVolume)));
    player.setVolume(normalizedVolume);
    volumeRef.current = normalizedVolume;
    setVolume(normalizedVolume);
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

  function fade(player: YouTubePlayer, from: number, to: number, seconds: number, onComplete: () => void, equalPower = false) {
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
      const nextVolume = to === 0
        ? from * (equalPower
          ? equalPowerFadeGain(progress)
          : specialFadeOutGain(progress, seconds))
        : from + (to - from) * progress;
      activePlayer.setVolume(Math.round(nextVolume));
      if (progress >= 1) {
        if (fadeTimerRef.current !== null) window.clearInterval(fadeTimerRef.current);
        fadeTimerRef.current = null;
        onComplete();
      }
    };
    tick();
    fadeTimerRef.current = window.setInterval(tick, 50);
  }

  function transitionToSong(nextStart: number, fadeWindow: FadeWindow | null = null, fallbackFadeSeconds = playbackSettings.fadeOutSeconds) {
    const player = getPlayer();
    if (!player || isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    const volume = volumeRef.current;
    const fadeSeconds = fadeDurationFromCurrentTime(fadeWindow, player.getCurrentTime(), fallbackFadeSeconds);
    fade(player, volume, 0, fadeSeconds, () => {
      if (fadeWindow) player.seekTo(fadeWindow.end, true);
      player.pauseVideo();
      transitionTimerRef.current = window.setTimeout(() => {
        const activePlayer = getPlayer();
        if (!activePlayer) return clearTransition();
        activePlayer.seekTo(nextStart, true);
        activePlayer.playVideo();
        previousTimeRef.current = nextStart;
        setStartAt(nextStart);
        if (fadeWindow || fallbackFadeSeconds > 0) {
          fade(activePlayer, 0, volume, playbackSettings.fadeInSeconds, clearTransition);
        } else {
          activePlayer.setVolume(volume);
          clearTransition();
        }
      }, playbackSettings.gapSeconds * 1000);
    }, Boolean(fadeWindow));
  }

  function fadeOutAndStop(
    end: number,
    fadeWindow: FadeWindow | null = null,
    fallbackFadeSeconds = playbackSettings.fadeOutSeconds,
    onStopped?: () => void,
  ) {
    const player = getPlayer();
    if (!player || isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    const volume = volumeRef.current;
    const fadeSeconds = fadeDurationFromCurrentTime(fadeWindow, player.getCurrentTime(), fallbackFadeSeconds);
    fade(player, volume, 0, fadeSeconds, () => {
      const activePlayer = getPlayer();
      if (!activePlayer) return clearTransition();
      activePlayer.seekTo(end, true);
      activePlayer.pauseVideo();
      previousTimeRef.current = end;
      setStartAt(end);
      clearTransition();
      onStopped?.();
    }, Boolean(fadeWindow));
  }

  useEffect(() => {
    transitionToSongRef.current = transitionToSong;
    fadeOutAndStopRef.current = fadeOutAndStop;
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
            setPlayerVolume(event.target, event.target.getVolume());
            setPlayerState(event.target.getPlayerState());
            setIsPlayerReady(true);
            if (shouldAutoplay) event.target.playVideo();
          },
          onStateChange: (event) => {
            if (cancelled || !isYouTubePlayer(event.target)) return;
            const player = event.target;
            if (event.data === YOUTUBE_PLAYER_ENDED) playAnotherVideo();
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
      const playableSongs = songs.filter((song) => song.clipEnd > song.clipStart);
      const currentSongIndex = playableSongs.findIndex(
        (song) => currentTime >= song.clipStart && currentTime < song.clipEnd,
      );
      if (currentSongIndex >= 0) {
        const currentSong = playableSongs[currentSongIndex];
        const fadeWindow = getBuiltInFadeWindow(currentSong, playbackSettings.builtInFade);
        const fallbackFadeSeconds = playbackSettings.builtInFade ? 0 : playbackSettings.fadeOutSeconds;
        const transitionAt = fadeWindow?.start ?? (
          playbackSettings.builtInFade
            ? currentSong.clipEnd
            : Math.max(currentSong.clipStart, currentSong.clipEnd - playbackSettings.fadeOutSeconds)
        );
        if (currentTime >= transitionAt && !isTransitioningRef.current) {
          const nextSong = playableSongs[currentSongIndex + 1];
          if (nextSong) transitionToSongRef.current(nextSong.clipStart, fadeWindow, fallbackFadeSeconds);
          else fadeOutAndStopRef.current(currentSong.clipEnd, fadeWindow, fallbackFadeSeconds, playAnotherVideo);
          return;
        }
      }
      const action = findOnlySongModeAction(
        songs,
        previousTimeRef.current,
        currentTime,
      );
      previousTimeRef.current = currentTime;

      if (action === null) return;

      if (action.type === "stop") {
        const stopAt = Math.max(0, action.end);
        fadeOutAndStopRef.current(
          stopAt,
          null,
          playbackSettings.builtInFade ? 0 : playbackSettings.fadeOutSeconds,
          playAnotherVideo,
        );
        return;
      }

      previousTimeRef.current = action.start;
      transitionToSongRef.current(
        action.start,
        null,
        playbackSettings.builtInFade ? 0 : playbackSettings.fadeOutSeconds,
      );
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [isPlayerReady, onlySongMode, playerState, playbackSettings, setStartAt, songs]);

  return (
    <div className="mb-4 md:max-w-[680px]">
      <div className="relative aspect-video rounded-[10px] overflow-hidden border border-border bg-black">
        <div ref={playerHostRef} className="absolute inset-0 h-full w-full" aria-label="Tiny Desk Concert" />
      </div>

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
          else {
            player.setVolume(volumeRef.current);
            player.playVideo();
          }
        }}
        onSeek={seekTo}
        onSkip={skipBy}
        volume={volume}
        onVolumeChange={(nextVolume) => {
          clearTransition();
          const player = getPlayer();
          if (player) setPlayerVolume(player, nextVolume);
        }}
        compact
        modeControl={
          <button
            type="button"
            aria-pressed={onlySongMode}
            onClick={() => setOnlySongMode(!onlySongMode)}
            data-feature-hint="only-song-mode"
            className={`group relative inline-flex shrink-0 items-center gap-1.5 overflow-hidden rounded-md border px-2 py-1.5 text-[11px] font-semibold transition-all ${
              onlySongMode
                ? "border-primary/60 bg-primary/15 text-primary shadow-[0_0_18px_oklch(0.68_0.17_25_/_0.25)]"
                : "border-primary/30 bg-[linear-gradient(120deg,oklch(0.68_0.17_25_/_0.12),transparent)] text-foreground hover:-translate-y-px hover:border-primary/60 hover:shadow-[0_0_16px_oklch(0.68_0.17_25_/_0.18)]"
            }`}
            title="Skip applause and talk between mapped songs"
          >
            <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-8 -translate-x-full skew-x-[-20deg] bg-primary/25 transition-transform duration-500 group-hover:translate-x-[430%]" />
            <Music2 aria-hidden size={13} className="relative" />
            <span className="relative sm:hidden">Songs</span>
            <span className="relative hidden sm:inline">Only songs</span>
          </button>
        }
      />

      {onlySongMode && (
        <PlaybackCustomizer
          settings={playbackSettings}
          onSettingsChange={setPlaybackSettings}
          isSignedIn={isSignedIn}
        />
      )}
    </div>
  );
}
