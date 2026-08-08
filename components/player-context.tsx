"use client";

import { createContext, useContext, useState } from "react";

/**
 * Shares "which timestamp is the embed currently seeked to" between the
 * video embed and the song list, without prop-drilling through the
 * (server) page component. Small enough not to need a real state library.
 */
const PlayerContext = createContext<{
  startAt: number;
  setStartAt: (seconds: number) => void;
} | null>(null);

export function PlayerProvider({
  initialStart,
  children,
}: {
  initialStart: number;
  children: React.ReactNode;
}) {
  const [startAt, setStartAt] = useState(initialStart);
  return (
    <PlayerContext.Provider value={{ startAt, setStartAt }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within a PlayerProvider");
  return ctx;
}
