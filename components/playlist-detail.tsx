"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addPlaylistSong,
  addPlaylistVideo,
  removePlaylistTrack,
} from "@/app/playlist/actions";
import { PlaceholderThumb } from "@/components/placeholder-thumb";
import { PlaylistPlayer } from "@/components/playlist-player";
import { formatTime } from "@/lib/format";
import type {
  Playlist,
  PlaylistSongOption,
  PlaylistTrack,
  PlaylistVideoOption,
} from "@/lib/types";

function songKey(videoId: string, songIndex: number) {
  return `song:${videoId}:${songIndex}`;
}

function videoKey(videoId: string) {
  return `video:${videoId}`;
}

function trackKey(track: PlaylistTrack) {
  return track.songIndex === null
    ? videoKey(track.performanceVideoId)
    : songKey(track.performanceVideoId, track.songIndex);
}

export function PlaylistDetail({
  playlist,
  songCatalog,
  videoCatalog,
  canManage,
  isSignedIn,
}: {
  playlist: Playlist;
  songCatalog: PlaylistSongOption[];
  videoCatalog: PlaylistVideoOption[];
  canManage: boolean;
  isSignedIn: boolean;
}) {
  const router = useRouter();
  const [tracks, setTracks] = useState(playlist.tracks);
  const [isAddItemsOpen, setIsAddItemsOpen] = useState(false);
  const [selectedTrackIndex, setSelectedTrackIndex] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalSeconds = tracks.reduce((sum, track) => sum + track.duration, 0);
  const existingKeys = useMemo(() => new Set(tracks.map(trackKey)), [tracks]);
  const filteredSongs = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return songCatalog;
    return songCatalog.filter((song) =>
      `${song.title} ${song.artist} ${song.performanceLabel}`.toLowerCase().includes(query),
    );
  }, [search, songCatalog]);
  const filteredVideos = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return videoCatalog;
    return videoCatalog.filter((video) =>
      `${video.title} ${video.artist} ${video.performanceLabel}`.toLowerCase().includes(query),
    );
  }, [search, videoCatalog]);

  function nextPosition(current: PlaylistTrack[]) {
    return Math.max(0, ...current.map((track) => track.position)) + 1;
  }

  async function handleAddSong(song: PlaylistSongOption) {
    const key = songKey(song.performanceVideoId, song.songIndex);
    if (existingKeys.has(key)) return;

    setPendingKey(key);
    setError(null);
    const result = await addPlaylistSong({
      playlistId: playlist.id,
      performanceVideoId: song.performanceVideoId,
      songIndex: song.songIndex,
    });

    if (result?.error) {
      setError(result.error);
    } else {
      setTracks((current) => [
        ...current,
        { ...song, index: current.length + 1, position: nextPosition(current) },
      ]);
      router.refresh();
    }
    setPendingKey(null);
  }

  async function handleAddVideo(video: PlaylistVideoOption) {
    const key = videoKey(video.performanceVideoId);
    if (existingKeys.has(key)) return;

    setPendingKey(key);
    setError(null);
    const result = await addPlaylistVideo({
      playlistId: playlist.id,
      performanceVideoId: video.performanceVideoId,
    });

    if (result?.error) {
      setError(result.error);
    } else {
      setTracks((current) => [
        ...current,
        {
          ...video,
          index: current.length + 1,
          position: nextPosition(current),
          songIndex: null,
          clipStart: 0,
          clipEnd: video.duration,
        },
      ]);
      router.refresh();
    }
    setPendingKey(null);
  }

  async function handleRemove(track: PlaylistTrack) {
    setPendingKey(trackKey(track));
    setError(null);
    const result = await removePlaylistTrack({
      playlistId: playlist.id,
      position: track.position,
    });

    if (result?.error) {
      setError(result.error);
    } else {
      setTracks((current) =>
        current
          .filter((item) => item.position !== track.position)
          .map((item, index) => ({ ...item, index: index + 1 })),
      );
      router.refresh();
    }
    setPendingKey(null);
  }

  function selectTrack(index: number) {
    setSelectedTrackIndex(index);
  }

  const isSongPlaylist = playlist.type === "songs";
  const itemLabel = isSongPlaylist ? "songs" : "videos";
  const filteredItems = isSongPlaylist ? filteredSongs : filteredVideos;

  return (
    <main className="p-8">
      {tracks.length > 0 && (
        <PlaylistPlayer
          tracks={tracks}
          playlistType={playlist.type}
          selectedIndex={selectedTrackIndex}
          onSelectionConsumed={() => setSelectedTrackIndex(null)}
        />
      )}

      <div className="mb-7 flex flex-col items-start gap-6 sm:flex-row sm:items-end">
        <PlaceholderThumb label={isSongPlaylist ? "SONGS" : "VIDEOS"} className="h-[180px] w-[180px] shrink-0 rounded-[10px]" />
        <div>
          <div className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {isSongPlaylist ? "Song playlist" : "Video playlist"}
          </div>
          <h1 className="mb-2.5 text-[32px] font-bold text-foreground">{playlist.name}</h1>
          <p className="mb-4.5 text-[13px] text-muted-foreground">
            by {playlist.owner} · {tracks.length} {tracks.length === 1 ? itemLabel.slice(0, -1) : itemLabel} · {Math.round(totalSeconds / 60)} min
          </p>
          <div className="flex items-center gap-3.5">
            {canManage ? (
              <button
                type="button"
                onClick={() => {
                  setIsAddItemsOpen((open) => !open);
                  setError(null);
                }}
                className="text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {isAddItemsOpen ? `Done adding ${itemLabel}` : `+ Add ${itemLabel}`}
              </button>
            ) : isSignedIn ? (
              <span className="text-[13px] font-medium text-muted-foreground">Read-only playlist</span>
            ) : (
              <Link href="/login" className="text-[13px] font-medium text-muted-foreground hover:text-foreground">
                Sign in to add {itemLabel}
              </Link>
            )}
          </div>
        </div>
      </div>

      {isAddItemsOpen && canManage && (
        <section className="mb-6 rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Add {itemLabel}</h2>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                Search the Tiny Office catalog and add {isSongPlaylist ? "song clips" : "full performances"} one at a time.
              </p>
            </div>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={isSongPlaylist ? "Search songs or artists" : "Search artists or videos"}
              className="w-full rounded-lg border border-input bg-secondary px-3 py-2 text-[13px] text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary sm:max-w-[260px]"
            />
          </div>
          <div className="max-h-[390px] overflow-y-auto rounded-lg border border-border">
            {filteredItems.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">No {itemLabel} match that search.</p>
            ) : isSongPlaylist ? (
              filteredSongs.map((song) => {
                const key = songKey(song.performanceVideoId, song.songIndex);
                const isAdded = existingKeys.has(key);
                return (
                  <div key={key} className="flex items-center gap-3 border-b border-border px-3 py-3 last:border-b-0 sm:px-4">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-medium text-foreground">{song.title}</div>
                      <div className="truncate text-[12px] text-muted-foreground">{song.artist} · {song.performanceLabel}</div>
                    </div>
                    <span className="hidden shrink-0 font-mono text-xs text-muted-foreground sm:inline">{formatTime(song.duration)}</span>
                    <button
                      type="button"
                      onClick={() => void handleAddSong(song)}
                      disabled={isAdded || pendingKey !== null}
                      className="shrink-0 rounded-md border border-input px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:cursor-default disabled:opacity-60"
                    >
                      {pendingKey === key ? "Adding…" : isAdded ? "Added" : "Add"}
                    </button>
                  </div>
                );
              })
            ) : (
              filteredVideos.map((video) => {
                const key = videoKey(video.performanceVideoId);
                const isAdded = existingKeys.has(key);
                return (
                  <div key={key} className="flex items-center gap-3 border-b border-border px-3 py-3 last:border-b-0 sm:px-4">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-medium text-foreground">{video.title}</div>
                      <div className="truncate text-[12px] text-muted-foreground">{video.performanceLabel}</div>
                    </div>
                    <span className="hidden shrink-0 font-mono text-xs text-muted-foreground sm:inline">{formatTime(video.duration)}</span>
                    <button
                      type="button"
                      onClick={() => void handleAddVideo(video)}
                      disabled={isAdded || pendingKey !== null}
                      className="shrink-0 rounded-md border border-input px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:cursor-default disabled:opacity-60"
                    >
                      {pendingKey === key ? "Adding…" : isAdded ? "Added" : "Add"}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      {error && (
        <p className="mb-4 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-[12.5px] text-primary">{error}</p>
      )}

      <div
        className="grid items-center border-b border-border px-3.5 py-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80"
        style={{ gridTemplateColumns: canManage ? "28px minmax(0, 1fr) minmax(0, 1.1fr) 70px 72px" : "28px minmax(0, 1fr) minmax(0, 1.1fr) 70px" }}
      >
        <div>#</div>
        <div>{isSongPlaylist ? "Title" : "Performance"}</div>
        <div>{isSongPlaylist ? "From performance" : "Format"}</div>
        <div className="text-right">Time</div>
        {canManage && <div />}
      </div>

      {tracks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
          <p className="text-sm font-semibold text-foreground">This playlist is empty</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {canManage ? `Open Add ${itemLabel} to start building it.` : `The owner has not added any ${itemLabel} yet.`}
          </p>
        </div>
      ) : (
        tracks.map((track, index) => {
          const key = trackKey(track);
          return (
            <div
              key={`${track.position}-${key}`}
              role="button"
              tabIndex={0}
              onClick={() => selectTrack(index)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  selectTrack(index);
                }
              }}
              className="grid cursor-pointer items-center rounded-lg px-3.5 py-2.5 transition-colors hover:bg-secondary/50"
              style={{ gridTemplateColumns: canManage ? "28px minmax(0, 1fr) minmax(0, 1.1fr) 70px 72px" : "28px minmax(0, 1fr) minmax(0, 1.1fr) 70px" }}
            >
              <div className="font-mono text-xs text-muted-foreground">{track.index}</div>
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-medium text-foreground">{track.title}</div>
                <div className="truncate text-xs text-muted-foreground">{isSongPlaylist ? track.artist : "Full performance"}</div>
              </div>
              <div className="truncate text-[12.5px] text-muted-foreground">{isSongPlaylist ? track.performanceLabel : "Full video"}</div>
              <div className="font-mono text-xs text-muted-foreground text-right">{formatTime(track.duration)}</div>
              {canManage && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleRemove(track);
                  }}
                  disabled={pendingKey !== null}
                  className="ml-2 justify-self-end rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-primary disabled:cursor-wait disabled:opacity-60"
                >
                  {pendingKey === key ? "Removing…" : "Remove"}
                </button>
              )}
            </div>
          );
        })
      )}
    </main>
  );
}
