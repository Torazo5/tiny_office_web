"use client";

import { createContext, useCallback, useContext, useState } from "react";
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
  playbackSettings: PlaybackSettings;
  setPlaybackSettings: (settings: PlaybackSettings) => void;
  isSignedIn: boolean;
} | null>(null);

export function PlayerProvider({
  initialStart,
  songs,
  initialPlaybackSettings,
  isSignedIn,
  children,
}: {
  initialStart: number;
  songs: Song[];
  initialPlaybackSettings: PlaybackSettings;
  isSignedIn: boolean;
  children: React.ReactNode;
}) {
  const [startAt, setStartAtState] = useState(initialStart);
  const [seekRequestId, setSeekRequestId] = useState(0);
  const [currentTime, setCurrentTime] = useState(initialStart);
  const [onlySongMode, setOnlySongMode] = useState(false);
  const [playbackSettings, setPlaybackSettings] = useState(initialPlaybackSettings);

  const setStartAt = useCallback((seconds: number) => {
    setStartAtState(seconds);
    setSeekRequestId((requestId) => requestId + 1);
    setCurrentTime(seconds);
  }, []);

  return (
    <PlayerContext.Provider
      value={{ songs, startAt, setStartAt, seekRequestId, currentTime, setCurrentTime, onlySongMode, setOnlySongMode, playbackSettings, setPlaybackSettings, isSignedIn }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within a PlayerProvider");
  return ctx;
}
