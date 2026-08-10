"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { History, Play, Trash2, X } from "lucide-react";
import type { PlaylistTrack } from "@/lib/types";

const STORAGE_KEY = "tiny-office:adventure:recently-played";
const STORAGE_EVENT = "tiny-office:adventure:recently-played:change";
const MAX_RECENTLY_PLAYED = 12;
const EMPTY_SNAPSHOT = "[]";

export function recentlyPlayedKey(track: PlaylistTrack) {
  return `${track.performanceVideoId}:${track.songIndex ?? "video"}`;
}

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => undefined;

  const handleStorageChange = () => onStoreChange();
  window.addEventListener("storage", handleStorageChange);
  window.addEventListener(STORAGE_EVENT, handleStorageChange);

  return () => {
    window.removeEventListener("storage", handleStorageChange);
    window.removeEventListener(STORAGE_EVENT, handleStorageChange);
  };
}

function getSnapshot() {
  if (typeof window === "undefined") return EMPTY_SNAPSHOT;
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? EMPTY_SNAPSHOT;
  } catch {
    return EMPTY_SNAPSHOT;
  }
}

function getServerSnapshot() {
  return EMPTY_SNAPSHOT;
}

function isPlaylistTrack(value: unknown): value is PlaylistTrack {
  if (!value || typeof value !== "object") return false;
  const track = value as Partial<PlaylistTrack>;

  return (
    typeof track.index === "number" &&
    typeof track.position === "number" &&
    typeof track.title === "string" &&
    typeof track.artist === "string" &&
    typeof track.performanceLabel === "string" &&
    typeof track.performanceVideoId === "string" &&
    (typeof track.songIndex === "number" || track.songIndex === null) &&
    typeof track.clipStart === "number" &&
    typeof track.clipEnd === "number" &&
    typeof track.duration === "number" &&
    Array.isArray(track.songClips)
  );
}

function parseTracks(snapshot: string): PlaylistTrack[] {
  try {
    const parsed: unknown = JSON.parse(snapshot);
    return Array.isArray(parsed) ? parsed.filter(isPlaylistTrack).slice(0, MAX_RECENTLY_PLAYED) : [];
  } catch {
    return [];
  }
}

export function useRecentlyPlayed() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const tracks = useMemo(() => parseTracks(snapshot), [snapshot]);

  const addTrack = useCallback((track: PlaylistTrack) => {
    if (typeof window === "undefined") return;

    const currentTracks = parseTracks(getSnapshot());
    const nextTracks = [
      track,
      ...currentTracks.filter((currentTrack) => recentlyPlayedKey(currentTrack) !== recentlyPlayedKey(track)),
    ].slice(0, MAX_RECENTLY_PLAYED);

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextTracks));
      window.dispatchEvent(new Event(STORAGE_EVENT));
    } catch {
      // Private browsing and storage quotas can make localStorage unavailable.
    }
  }, []);

  const clearTracks = useCallback(() => {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(new Event(STORAGE_EVENT));
    } catch {
      // Ignore storage failures; the history is only a convenience.
    }
  }, []);

  return { tracks, addTrack, clearTracks };
}

export function RecentlyPlayedPanel({
  tracks,
  onPlay,
  onClear,
  onClose,
}: {
  tracks: PlaylistTrack[];
  onPlay: (track: PlaylistTrack) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  return (
    <section className="mb-5 overflow-hidden rounded-xl border border-border bg-card" aria-label="Recently played">
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <History aria-hidden className="size-4 text-primary" strokeWidth={2.2} />
            <h2 className="text-sm font-semibold text-foreground">Recently played</h2>
          </div>
          <p className="mt-1 text-[12px] text-muted-foreground">
            The last songs you started in Feeling Adventurous.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label="Close recently played"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>

      {tracks.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm font-medium text-foreground">Nothing here yet</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Start a song and it will show up here for an easy replay.
          </p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-border">
            {tracks.map((track) => (
              <div key={recentlyPlayedKey(track)} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-foreground">{track.title}</p>
                  <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                    {track.artist} · {track.performanceLabel}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onPlay(track)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-[11.5px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Play aria-hidden className="size-3" fill="currentColor" />
                  Play again
                </button>
              </div>
            ))}
          </div>
          <div className="flex justify-end border-t border-border px-5 py-3">
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <Trash2 aria-hidden className="size-3.5" />
              Clear history
            </button>
          </div>
        </>
      )}
    </section>
  );
}
