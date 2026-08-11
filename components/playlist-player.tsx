"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PlayerControls } from "@/components/player-controls";
import { PlaybackCustomizer } from "@/components/playback-customizer";
import { SongHeartButton } from "@/components/song-heart-button";
import { DEFAULT_PLAYBACK_SETTINGS, type PlaybackSettings } from "@/lib/playback-settings";
import type { PlaylistTrack, PlaylistType } from "@/lib/types";
import { findOnlySongModeAction } from "@/lib/only-song-mode";
import {
  equalPowerFadeGain,
  fadeDurationFromCurrentTime,
  getBuiltInFadeWindow,
  specialFadeOutGain,
  type FadeWindow,
} from "@/lib/playback-fade";
import {
  createYouTubePlayer,
  isYouTubePlayer,
  loadYouTubeIframeApi,
  type YouTubePlayer,
} from "@/lib/youtube-iframe-api";

const PLAYER_ENDED = 0;
const PLAYER_PLAYING = 1;
const PLAYER_BUFFERING = 3;
const FADE_INTERVAL_MS = 50;

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

export function PlaylistPlayer({
  tracks,
  playlistType,
  selectedIndex,
  onSelectionConsumed,
  onlySongMode = playlistType === "videos",
  initialPlaybackSettings = DEFAULT_PLAYBACK_SETTINGS,
  isSignedIn = false,
  onCurrentTrackChange,
  onTrackPlay,
  playButtonHintTarget,
  sidebarHeader,
  initialHeartedSongKeys = [],
  songHeartReturnPath,
}: {
  tracks: PlaylistTrack[];
  playlistType: PlaylistType;
  selectedIndex: number | null;
  onSelectionConsumed: () => void;
  onlySongMode?: boolean;
  initialPlaybackSettings?: PlaybackSettings;
  isSignedIn?: boolean;
  onCurrentTrackChange?: (track: PlaylistTrack) => void;
  onTrackPlay?: (track: PlaylistTrack) => void;
  playButtonHintTarget?: string;
  sidebarHeader?: React.ReactNode;
  initialHeartedSongKeys?: string[];
  songHeartReturnPath?: string;
}) {
  const playerHostRef = useRef<HTMLDivElement>(null);
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
  const playbackSettingsRef = useRef(initialPlaybackSettings);
  const fadeTimerRef = useRef<number | null>(null);
  const fadeInTimerRef = useRef<number | null>(null);
  const gapTimerRef = useRef<number | null>(null);
  const isFadingRef = useRef(false);
  const fadeVolumeRef = useRef(100);
  const restoreVolumeRef = useRef<number | null>(null);
  const volumeRef = useRef(100);
  const loadTrackRef = useRef<(index: number, preservePlaybackOrder?: boolean) => void>(() => undefined);
  const advanceToNextRef = useRef<() => void>(() => undefined);
  const fadeOutAndAdvanceRef = useRef<(fadeWindow?: FadeWindow | null, fallbackFadeSeconds?: number) => void>(() => undefined);
  const fadeOutAndStopRef = useRef<(end: number, fadeWindow?: FadeWindow | null, fallbackFadeSeconds?: number) => void>(() => undefined);
  const beginGapBeforeNextRef = useRef<() => void>(() => undefined);
  const transitionWithinVideoRef = useRef<(nextSongStart: number, fadeWindow?: FadeWindow | null, fallbackFadeSeconds?: number) => void>(() => undefined);
  const onTrackPlayRef = useRef(onTrackPlay);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(tracks[0]?.clipStart ?? 0);
  const [playerState, setPlayerState] = useState<number | null>(null);
  const [isLooping, setIsLooping] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [shufflePosition, setShufflePosition] = useState(0);
  const [playbackSettings, setPlaybackSettings] = useState(initialPlaybackSettings);
  const [volume, setVolume] = useState(100);

  function getPlayer() {
    const player = playerRef.current;
    return isYouTubePlayer(player) ? player : null;
  }

  const resetShuffleOrder = useCallback((startIndex: number) => {
    shuffleOrderRef.current = createShuffleOrder(tracksRef.current, startIndex);
    shufflePositionRef.current = 0;
    setShufflePosition(0);
  }, []);

  function clearFadeTimer() {
    if (fadeTimerRef.current !== null) {
      window.clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  }

  function clearTransitionTimers() {
    if (fadeInTimerRef.current !== null) {
      window.clearInterval(fadeInTimerRef.current);
      fadeInTimerRef.current = null;
    }
    if (gapTimerRef.current !== null) {
      window.clearTimeout(gapTimerRef.current);
      gapTimerRef.current = null;
    }
  }

  function cancelFade() {
    if (!isFadingRef.current) return;
    clearFadeTimer();
    const player = getPlayer();
    if (player) player.setVolume(restoreVolumeRef.current ?? volumeRef.current);
    restoreVolumeRef.current = null;
    isFadingRef.current = false;
  }

  function upcomingTrackExists() {
    if (isLoopingRef.current) return false;
    if (isShufflingRef.current) {
      const shuffleOrder = shuffleOrderRef.current;
      return Boolean(shuffleOrder && shufflePositionRef.current + 1 < shuffleOrder.length);
    }
    return currentIndexRef.current + 1 < tracksRef.current.length;
  }

  function getCurrentVolume(player: YouTubePlayer) {
    const volume = player.getVolume();
    return Number.isFinite(volume) ? Math.min(100, Math.max(0, volume)) : 100;
  }

  function setPlayerVolume(player: YouTubePlayer, nextVolume: number) {
    const normalizedVolume = Math.min(100, Math.max(0, Math.round(nextVolume)));
    player.setVolume(normalizedVolume);
    volumeRef.current = normalizedVolume;
    setVolume(normalizedVolume);
  }

  function fadeOutAndAdvance(fadeWindow: FadeWindow | null = null, fallbackFadeSeconds = playbackSettingsRef.current.fadeOutSeconds) {
    const player = getPlayer();
    const fadeDuration = player
      ? fadeDurationFromCurrentTime(fadeWindow, player.getCurrentTime(), fallbackFadeSeconds)
      : fallbackFadeSeconds;
    if (isFadingRef.current) return;
    if (!player || fadeDuration <= 0 || !upcomingTrackExists()) {
      beginGapBeforeNext();
      return;
    }

    isFadingRef.current = true;
    fadeVolumeRef.current = volumeRef.current;
    restoreVolumeRef.current = fadeVolumeRef.current;
    const startedAt = performance.now();

    const tick = () => {
      const currentPlayer = getPlayer();
      if (!currentPlayer) {
        clearFadeTimer();
        isFadingRef.current = false;
        return;
      }

      const progress = Math.min(1, (performance.now() - startedAt) / (fadeDuration * 1000));
      currentPlayer.setVolume(Math.round(
        fadeVolumeRef.current * (fadeWindow
          ? equalPowerFadeGain(progress)
          : specialFadeOutGain(progress, fadeDuration)),
      ));
      if (progress >= 1) {
        clearFadeTimer();
        isFadingRef.current = false;
        if (fadeWindow) currentPlayer.seekTo(fadeWindow.end, true);
        beginGapBeforeNext();
      }
    };

    tick();
    fadeTimerRef.current = window.setInterval(tick, FADE_INTERVAL_MS);
  }

  function fadeOutAndStop(end: number, fadeWindow: FadeWindow | null = null, fallbackFadeSeconds = playbackSettingsRef.current.fadeOutSeconds) {
    const player = getPlayer();
    const fadeDuration = player
      ? fadeDurationFromCurrentTime(fadeWindow, player.getCurrentTime(), fallbackFadeSeconds)
      : fallbackFadeSeconds;
    if (!player || isFadingRef.current) return;
    if (fadeDuration <= 0) {
      player.seekTo(end, true);
      player.pauseVideo();
      setPlayerState(2);
      return;
    }
    isFadingRef.current = true;
    fadeVolumeRef.current = volumeRef.current;
    const startedAt = performance.now();
    const tick = () => {
      const currentPlayer = getPlayer();
      if (!currentPlayer) {
        clearFadeTimer();
        isFadingRef.current = false;
        return;
      }
      const progress = Math.min(1, (performance.now() - startedAt) / (fadeDuration * 1000));
      currentPlayer.setVolume(Math.round(
        fadeVolumeRef.current * (fadeWindow
          ? equalPowerFadeGain(progress)
          : specialFadeOutGain(progress, fadeDuration)),
      ));
      if (progress >= 1) {
        clearFadeTimer();
        isFadingRef.current = false;
        currentPlayer.seekTo(end, true);
        currentPlayer.pauseVideo();
        currentPlayer.setVolume(fadeVolumeRef.current);
        previousTimeRef.current = end;
        setCurrentTime(end);
        setPlayerState(2);
      }
    };
    tick();
    fadeTimerRef.current = window.setInterval(tick, FADE_INTERVAL_MS);
  }

  function beginFadeIn(player: YouTubePlayer) {
    const fadeDuration = playbackSettingsRef.current.fadeInSeconds;
    if (fadeDuration <= 0) return;
    clearTransitionTimers();
    const targetVolume = volumeRef.current;
    player.setVolume(0);
    const startedAt = performance.now();
    const tick = () => {
      const currentPlayer = getPlayer();
      if (!currentPlayer) {
        clearTransitionTimers();
        return;
      }
      const progress = Math.min(1, (performance.now() - startedAt) / (fadeDuration * 1000));
      currentPlayer.setVolume(Math.round(targetVolume * progress));
      if (progress >= 1 && fadeInTimerRef.current !== null) {
        window.clearInterval(fadeInTimerRef.current);
        fadeInTimerRef.current = null;
      }
    };
    tick();
    fadeInTimerRef.current = window.setInterval(tick, FADE_INTERVAL_MS);
  }

  function loadTrack(index: number, preservePlaybackOrder = false, fadeIn = false) {
    const track = tracksRef.current[index];
    const player = getPlayer();
    if (!track || !player) return;
    cancelFade();

    if (isShufflingRef.current && !preservePlaybackOrder) resetShuffleOrder(index);
    const previousTrack = tracksRef.current[currentIndexRef.current];
    currentIndexRef.current = index;
    setCurrentIndex(index);
    const startAt = Math.max(0, track.clipStart);
    previousTimeRef.current = startAt;
    setCurrentTime(startAt);
    advanceLockRef.current = true;
    if (restoreVolumeRef.current !== null) {
      player.setVolume(restoreVolumeRef.current);
      restoreVolumeRef.current = null;
    }
    if (previousTrack?.performanceVideoId === track.performanceVideoId) {
      player.seekTo(Math.max(0, track.clipStart), true);
      player.playVideo();
    } else {
      player.loadVideoById(track.performanceVideoId, Math.max(0, track.clipStart));
    }
    if (fadeIn) window.setTimeout(() => beginFadeIn(player), 120);
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
        getPlayer()?.pauseVideo();
        setPlayerState(2);
        return;
      }
      shufflePositionRef.current = nextPosition;
      setShufflePosition(nextPosition);
      nextIndex = shuffleOrder[nextPosition];
    } else {
      nextIndex = currentIndexRef.current + 1;
      if (nextIndex >= tracksRef.current.length) {
        getPlayer()?.pauseVideo();
        setPlayerState(2);
        return;
      }
    }
    loadTrack(nextIndex, true, true);
  }

  function beginGapBeforeNext() {
    clearTransitionTimers();
    const player = getPlayer();
    if (!player || !upcomingTrackExists()) {
      advanceToNextRef.current();
      return;
    }
    player.pauseVideo();
    gapTimerRef.current = window.setTimeout(() => {
      gapTimerRef.current = null;
      advanceToNextRef.current();
    }, playbackSettingsRef.current.gapSeconds * 1000);
  }

  function transitionWithinVideo(nextSongStart: number, fadeWindow: FadeWindow | null = null, fallbackFadeSeconds = playbackSettingsRef.current.fadeOutSeconds) {
    const player = getPlayer();
    if (!player) return;
    const beginGap = () => {
      player.pauseVideo();
      clearTransitionTimers();
      gapTimerRef.current = window.setTimeout(() => {
        gapTimerRef.current = null;
        const currentPlayer = getPlayer();
        if (!currentPlayer) return;
        currentPlayer.seekTo(nextSongStart, true);
        currentPlayer.playVideo();
        previousTimeRef.current = nextSongStart;
        setCurrentTime(nextSongStart);
        if (fadeWindow || fallbackFadeSeconds > 0) beginFadeIn(currentPlayer);
        else currentPlayer.setVolume(volumeRef.current);
      }, playbackSettingsRef.current.gapSeconds * 1000);
    };
    const fadeDuration = fadeDurationFromCurrentTime(
      fadeWindow,
      player.getCurrentTime(),
      fallbackFadeSeconds,
    );
    if (fadeDuration <= 0 || isFadingRef.current) {
      beginGap();
      return;
    }
    isFadingRef.current = true;
    fadeVolumeRef.current = volumeRef.current;
    const startedAt = performance.now();
    const tick = () => {
      const currentPlayer = getPlayer();
      if (!currentPlayer) {
        clearFadeTimer();
        isFadingRef.current = false;
        return;
      }
      const progress = Math.min(1, (performance.now() - startedAt) / (fadeDuration * 1000));
      currentPlayer.setVolume(Math.round(
        fadeVolumeRef.current * (fadeWindow
          ? equalPowerFadeGain(progress)
          : specialFadeOutGain(progress, fadeDuration)),
      ));
      if (progress >= 1) {
        clearFadeTimer();
        isFadingRef.current = false;
        if (fadeWindow) currentPlayer.seekTo(fadeWindow.end, true);
        currentPlayer.setVolume(fadeVolumeRef.current);
        beginGap();
      }
    };
    tick();
    fadeTimerRef.current = window.setInterval(tick, FADE_INTERVAL_MS);
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
    getPlayer()?.seekTo(nextTime, allowSeekAhead);
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
    playbackSettingsRef.current = playbackSettings;
  }, [playbackSettings]);

  useEffect(() => {
    loadTrackRef.current = loadTrack;
    advanceToNextRef.current = advanceToNext;
    fadeOutAndAdvanceRef.current = fadeOutAndAdvance;
    fadeOutAndStopRef.current = fadeOutAndStop;
    beginGapBeforeNextRef.current = beginGapBeforeNext;
    transitionWithinVideoRef.current = transitionWithinVideo;
  });

  useEffect(() => {
    onTrackPlayRef.current = onTrackPlay;
  }, [onTrackPlay]);

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

    if (!tracksRef.current[0] || !playerHostRef.current) return;

    void loadYouTubeIframeApi()
      .then((api) => {
        const firstTrack = tracksRef.current[0];
        if (cancelled || !playerHostRef.current || !firstTrack) return;

        const player = createYouTubePlayer(api, playerHostRef.current, firstTrack.performanceVideoId, {
          onReady: (event) => {
            if (cancelled || !isYouTubePlayer(event.target)) return;
            playerRef.current = event.target;
            const currentTime = event.target.getCurrentTime();
            previousTimeRef.current = currentTime;
            setCurrentTime(currentTime);
            setPlayerVolume(event.target, getCurrentVolume(event.target));
            setPlayerState(event.target.getPlayerState());
            setIsPlayerReady(true);
          },
          onStateChange: (event) => {
            if (cancelled || !isYouTubePlayer(event.target)) return;
            const player = event.target;
            if (event.data !== PLAYER_BUFFERING) {
              const currentTime = player.getCurrentTime();
              previousTimeRef.current = currentTime;
              setCurrentTime(currentTime);
            }
            setPlayerState(event.data);
            if (event.data === PLAYER_PLAYING) {
              const track = tracksRef.current[currentIndexRef.current];
              if (track) onTrackPlayRef.current?.(track);
            }
            if (event.data === PLAYER_ENDED) {
              if (isFadingRef.current) return;
              if (isLoopingRef.current) loadTrackRef.current(currentIndexRef.current, true);
              else beginGapBeforeNextRef.current();
            }
          },
        }, firstTrack.clipStart);

        if (player) playerRef.current = player;
      })
      .catch(() => {
        // The native YouTube controls remain available if the API is unavailable.
      });

    return () => {
      cancelled = true;
      clearFadeTimer();
      clearTransitionTimers();
      isFadingRef.current = false;
      restoreVolumeRef.current = null;
      const player = playerRef.current;
      if (isYouTubePlayer(player)) player.destroy();
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
      if (!isYouTubePlayer(player) || !track || player.getPlayerState() !== PLAYER_PLAYING) return;

      const currentTime = player.getCurrentTime();
      setCurrentTime(currentTime);
      if (scrubbingRef.current) {
        previousTimeRef.current = currentTime;
        return;
      }

      if (playlistType === "songs") {
        const effectiveClipEnd = Math.max(track.clipEnd, track.clipStart + 0.5);
        const builtInFadeWindow = getBuiltInFadeWindow(track, playbackSettingsRef.current.builtInFade);
        const fadeDuration = playbackSettingsRef.current.builtInFade
          ? 0
          : playbackSettingsRef.current.fadeOutSeconds;
        const endThreshold = builtInFadeWindow?.start ?? (
          playbackSettingsRef.current.builtInFade
            ? effectiveClipEnd
            : Math.max(track.clipStart + 0.5, effectiveClipEnd - (fadeDuration || 0.35))
        );
        if (currentTime >= endThreshold) {
          if (isFadingRef.current) return;
          if (isLoopingRef.current) loadTrackRef.current(currentIndexRef.current, true);
          else if (!upcomingTrackExists()) fadeOutAndStopRef.current(effectiveClipEnd, builtInFadeWindow, fadeDuration);
          else if (fadeDuration > 0 || builtInFadeWindow) fadeOutAndAdvanceRef.current(builtInFadeWindow, fadeDuration);
          else beginGapBeforeNextRef.current();
        }
        return;
      }

      const shouldCutAudience = onlySongMode || playbackSettingsRef.current.cutAudience;
      if (!shouldCutAudience) return;

      const playableClips = track.songClips.filter((clip) => clip.clipEnd > clip.clipStart);
      const currentClipIndex = playableClips.findIndex(
        (clip) => currentTime >= clip.clipStart && currentTime < clip.clipEnd,
      );
      if (currentClipIndex >= 0) {
        const currentClip = playableClips[currentClipIndex];
        const builtInFadeWindow = getBuiltInFadeWindow(currentClip, playbackSettingsRef.current.builtInFade);
        const fadeDuration = playbackSettingsRef.current.builtInFade
          ? 0
          : playbackSettingsRef.current.fadeOutSeconds;
        const transitionAt = builtInFadeWindow?.start ?? (
          playbackSettingsRef.current.builtInFade
            ? currentClip.clipEnd
            : Math.max(currentClip.clipStart, currentClip.clipEnd - playbackSettingsRef.current.fadeOutSeconds)
        );
        if (currentTime >= transitionAt && !isFadingRef.current) {
          const nextClip = playableClips[currentClipIndex + 1];
          if (nextClip) transitionWithinVideoRef.current(nextClip.clipStart, builtInFadeWindow, fadeDuration);
          else if (upcomingTrackExists()) fadeOutAndAdvanceRef.current(builtInFadeWindow, fadeDuration);
          else fadeOutAndStopRef.current(currentClip.clipEnd, builtInFadeWindow, fadeDuration);
          return;
        }
      }

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
          beginGapBeforeNextRef.current();
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
      transitionWithinVideoRef.current(
        action.start,
        null,
        playbackSettingsRef.current.builtInFade ? 0 : playbackSettingsRef.current.fadeOutSeconds,
      );
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
    <section className="mb-8 max-w-[980px] rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="min-w-0">
          <div className="relative aspect-video overflow-hidden rounded-lg border border-border bg-black">
            <div ref={playerHostRef} className="absolute inset-0 h-full w-full" aria-label="Playlist player" />
          </div>

          <PlayerControls
            currentTime={currentTime}
            rangeStart={timelineStart}
            rangeEnd={timelineEnd}
            isPlaying={isPlaying}
            isReady={isPlayerReady}
            onTogglePlay={() => {
              const player = getPlayer();
              if (!player) return;
              if (isPlaying) player.pauseVideo();
              else player.playVideo();
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
            volume={volume}
            onVolumeChange={(nextVolume) => {
              cancelFade();
              clearTransitionTimers();
              const player = getPlayer();
              if (player) setPlayerVolume(player, nextVolume);
            }}
            playButtonHintTarget={playButtonHintTarget}
            compact
          />

          <PlaybackCustomizer
            settings={playbackSettings}
            onSettingsChange={setPlaybackSettings}
            isSignedIn={isSignedIn}
          />
        </div>

        <div className="space-y-4">
          {sidebarHeader}
          <Link
            href={`/video/${currentTrack.performanceVideoId}`}
            className="group block rounded-xl border border-border bg-secondary/25 p-4 transition-colors hover:border-primary/55 hover:bg-secondary/50"
          >
          <div className="flex items-center justify-between gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
            <span>Now playing</span>
            <span>{isBuffering ? "Loading…" : `${currentIndex + 1} / ${tracks.length}`}</span>
          </div>
          <h2 className="mt-3 line-clamp-2 text-[15px] font-semibold text-foreground">{currentTrack.title}</h2>
          <p className="mt-1 truncate text-[12px] text-muted-foreground">{currentTrack.artist}</p>
          <div className="mt-4 border-t border-border/80 pt-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">From this performance</div>
            <div className="mt-1 line-clamp-2 text-[12.5px] font-medium text-foreground">{currentTrack.performanceLabel}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{playlistType === "songs" ? "Song clip" : "Full performance"} · {kindLabel}</div>
          </div>
          <span className="mt-4 inline-flex text-[12px] font-semibold text-primary transition-transform group-hover:translate-x-0.5">
            Open performance →
          </span>
          <p className="mt-4 border-t border-border/80 pt-3 text-[11.5px] leading-relaxed text-muted-foreground">
            One player stays mounted while the next {playlistType === "songs" ? "song clip" : "performance"} loads in place.
            {playlistType === "videos"
              ? onlySongMode
                ? " Gaps between mapped songs are skipped."
                : " This performance plays from start to finish."
              : ""}
          </p>
          </Link>
          {currentTrack.songIndex !== null && songHeartReturnPath && (
            <SongHeartButton
              key={`${currentTrack.performanceVideoId}:${currentTrack.songIndex}`}
              performanceVideoId={currentTrack.performanceVideoId}
              songIndex={currentTrack.songIndex}
              initialHearted={initialHeartedSongKeys.includes(`${currentTrack.performanceVideoId}:${currentTrack.songIndex}`)}
              initialHeartCount={currentTrack.heartCount}
              isSignedIn={isSignedIn}
              returnPath={songHeartReturnPath}
            />
          )}
        </div>
      </div>
    </section>
  );
}
