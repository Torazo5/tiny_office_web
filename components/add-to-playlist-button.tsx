"use client";

import Link from "next/link";
import { useState } from "react";
import { addPlaylistSong, addPlaylistVideo } from "@/app/playlist/actions";
import { trackEvent } from "@/components/analytics";
import type { PlaylistSummary } from "@/lib/types";

type PlaylistItem =
  | { kind: "video"; performanceVideoId: string }
  | { kind: "song"; performanceVideoId: string; songIndex: number };

export function AddToPlaylistButton({
  item,
  playlists,
  isSignedIn,
  returnPath = "/",
}: {
  item: PlaylistItem;
  playlists: PlaylistSummary[];
  isSignedIn: boolean;
  returnPath?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingPlaylistId, setPendingPlaylistId] = useState<string | null>(null);
  const [addedPlaylistIds, setAddedPlaylistIds] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const isSong = item.kind === "song";
  const playlistLabel = isSong ? "Song playlists" : "Video playlists";

  if (!isSignedIn) {
    return (
      <Link
        href={{ pathname: "/login", query: { next: returnPath } }}
        className="inline-flex min-h-9 items-center rounded-md border border-input px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground sm:min-h-0"
      >
        + Add to playlist
      </Link>
    );
  }

  async function handleAdd(playlistId: string) {
    setPendingPlaylistId(playlistId);
    setError(null);
    const result = item.kind === "song"
      ? await addPlaylistSong({
          playlistId,
          performanceVideoId: item.performanceVideoId,
          songIndex: item.songIndex,
        })
      : await addPlaylistVideo({ playlistId, performanceVideoId: item.performanceVideoId });

    if (result?.error) {
      setError(result.error);
    } else {
      setAddedPlaylistIds((current) => new Set(current).add(playlistId));
      trackEvent({
        eventName: "item_added_to_playlist",
        source: item.kind === "song" ? "song_playlist_menu" : "video_playlist_menu",
        performanceVideoId: item.performanceVideoId,
        songIndex: item.kind === "song" ? item.songIndex : undefined,
      });
    }
    setPendingPlaylistId(null);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setIsOpen((open) => !open);
          setError(null);
        }}
        aria-expanded={isOpen}
        className="inline-flex min-h-9 items-center rounded-md border border-input px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground sm:min-h-0"
      >
        + Add to playlist
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-1/2 z-20 mb-2 w-[min(16rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-border bg-card p-2 shadow-lg sm:left-0 sm:w-64 sm:translate-x-0">
          <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {playlistLabel}
          </div>
          {playlists.length === 0 ? (
            <div className="px-2 py-2">
              <p className="text-[12px] text-muted-foreground">
                Create a {isSong ? "song" : "video"} playlist first.
              </p>
              <Link
                href="/playlists"
                className="mt-2 inline-block text-[12px] font-medium text-primary hover:underline"
                onClick={() => setIsOpen(false)}
              >
                Open playlists
              </Link>
            </div>
          ) : (
            <div className="flex max-h-52 flex-col overflow-y-auto">
              {playlists.map((playlist) => {
                const isAdded = addedPlaylistIds.has(playlist.id);
                return (
                  <button
                    key={playlist.id}
                    type="button"
                    onClick={() => void handleAdd(playlist.id)}
                    disabled={isAdded || pendingPlaylistId !== null}
                    className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-left text-[12.5px] text-foreground transition-colors hover:bg-secondary disabled:cursor-default disabled:opacity-60"
                  >
                    <span className="min-w-0 truncate">{playlist.name}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {pendingPlaylistId === playlist.id ? "Adding…" : isAdded ? "Added" : "Add"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {error && <p className="px-2 pb-1 pt-2 text-[11.5px] text-primary">{error}</p>}
        </div>
      )}
    </div>
  );
}
