"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Song } from "@/lib/types";
import type { PlaybackSettings } from "@/lib/playback-settings";

/**
 * Shares the embed's current timestamp between the video embed and the song
 * list, without prop-drilling through the (server) page component. Small
 * enough not to need a real state library.
 */
const PlayerContext = createContext<{
  startAt: number;
  setStartAt: (seconds: number) => void;
  seekRequestId: number;
  currentTime: number;
  setCurrentTime: (seconds: number) => void;
  songs: Song[];
  onlySongMode: boolean;
  setOnlySongMode: (enabled: boolean) => void;
  autoplayEnabled: boolean;
  setAutoplayEnabled: (enabled: boolean) => void;
  playbackSettings: PlaybackSettings;
  setPlaybackSettings: (settings: PlaybackSettings) => void;
  isSignedIn: boolean;
} | null>(null);

/**
 * Song rows only need the active clip and a seek callback. Keeping this
 * separate from the live playback clock means the full song list does not
 * re-render four times a second while a video is playing.
 */
const SongActivityContext = createContext<{
  activeSongIndex: number | null;
  setStartAt: (seconds: number) => void;
} | null>(null);

export function PlayerProvider({
  initialStart,
  songs,
  initialPlaybackSettings,
  initialOnlySongMode = false,
  isSignedIn,
  children,
}: {
  initialStart: number;
  songs: Song[];
  initialPlaybackSettings: PlaybackSettings;
  initialOnlySongMode?: boolean;
  isSignedIn: boolean;
  children: React.ReactNode;
}) {
  const [startAt, setStartAtState] = useState(initialStart);
  const [seekRequestId, setSeekRequestId] = useState(0);
  const [currentTime, setCurrentTime] = useState(initialStart);
  const [onlySongMode, setOnlySongMode] = useState(initialOnlySongMode);
  const [autoplayEnabled, setAutoplayEnabled] = useState(true);
  const [playbackSettings, setPlaybackSettings] = useState(initialPlaybackSettings);

  const setStartAt = useCallback((seconds: number) => {
    setStartAtState(seconds);
    setSeekRequestId((requestId) => requestId + 1);
    setCurrentTime(seconds);
  }, []);
  const activeSongIndex = songs.find(
    (song) => currentTime >= song.clipStart && currentTime < Math.max(song.clipEnd, song.clipStart + 0.5),
  )?.index ?? null;
  const songActivity = useMemo(
    () => ({ activeSongIndex, setStartAt }),
    [activeSongIndex, setStartAt],
  );

  return (
    <PlayerContext.Provider
      value={{ songs, startAt, setStartAt, seekRequestId, currentTime, setCurrentTime, onlySongMode, setOnlySongMode, autoplayEnabled, setAutoplayEnabled, playbackSettings, setPlaybackSettings, isSignedIn }}
    >
      <SongActivityContext.Provider value={songActivity}>
        {children}
      </SongActivityContext.Provider>
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within a PlayerProvider");
  return ctx;
}

export function useSongActivity() {
  const ctx = useContext(SongActivityContext);
  if (!ctx) throw new Error("useSongActivity must be used within a PlayerProvider");
  return ctx;
}
