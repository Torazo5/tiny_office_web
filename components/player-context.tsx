"use client";

import { createContext, useContext, useState } from "react";
import type { Song } from "@/lib/types";

/**
 * Shares "which timestamp is the embed currently seeked to" between the
 * video embed and the song list, without prop-drilling through the
 * (server) page component. Small enough not to need a real state library.
 */
const PlayerContext = createContext<{
  startAt: number;
  setStartAt: (seconds: number) => void;
  songs: Song[];
  onlySongMode: boolean;
  setOnlySongMode: (enabled: boolean) => void;
} | null>(null);

export function PlayerProvider({
  initialStart,
  songs,
  children,
}: {
  initialStart: number;
  songs: Song[];
  children: React.ReactNode;
}) {
  const [startAt, setStartAt] = useState(initialStart);
  const [onlySongMode, setOnlySongMode] = useState(false);

  return (
    <PlayerContext.Provider
      value={{ songs, startAt, setStartAt, onlySongMode, setOnlySongMode }}
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
