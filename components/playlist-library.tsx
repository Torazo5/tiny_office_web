"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { createPlaylist, deletePlaylist } from "@/app/playlist/actions";
import { PlaceholderThumb } from "@/components/placeholder-thumb";
import type { PlaylistActionState } from "@/app/playlist/actions";
import type { PlaylistSummary } from "@/lib/types";

function trackLabel(count: number) {
  return `${count} ${count === 1 ? "song" : "songs"}`;
}

export function PlaylistLibrary({
  playlists,
  userId,
}: {
  playlists: PlaylistSummary[];
  userId: string | null;
}) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDeleting] = useTransition();
  const router = useRouter();
  const [createState, createAction, isCreating] = useActionState<
    PlaylistActionState,
    FormData
  >(createPlaylist, null);

  function handleDelete(playlist: PlaylistSummary) {
    if (!window.confirm(`Delete “${playlist.name}”? This cannot be undone.`)) return;

    setDeleteError(null);
    startDeleting(async () => {
      const result = await deletePlaylist(playlist.id);
      if (result?.error) {
        setDeleteError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-7">
        <div>
          <h1 className="text-[26px] font-bold text-foreground mb-1">Your playlists</h1>
          <p className="text-[13.5px] text-muted-foreground">
            Keep the songs you want to come back to in one place.
          </p>
        </div>
        {userId ? (
          <button
            type="button"
            onClick={() => setIsCreateOpen((open) => !open)}
            className="rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            {isCreateOpen ? "Close" : "+ New playlist"}
          </button>
        ) : (
          <Link
            href="/login"
            className="rounded-lg border border-input px-4 py-2 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign in to create
          </Link>
        )}
      </div>

      {isCreateOpen && userId && (
        <form
          action={createAction}
          className="mb-7 flex max-w-[560px] flex-col gap-3 rounded-xl border border-border bg-card p-5"
        >
          <div>
            <label htmlFor="playlist-name" className="text-sm font-semibold text-foreground">
              Name your playlist
            </label>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              You can add songs as soon as it is created.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="playlist-name"
              name="name"
              type="text"
              placeholder="Late Night Sets"
              maxLength={80}
              required
              autoFocus
              className="min-w-0 flex-1 rounded-lg border border-input bg-secondary px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary"
            />
            <button
              type="submit"
              disabled={isCreating}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
            >
              {isCreating ? "Creating…" : "Create playlist"}
            </button>
          </div>
          {createState?.error && <p className="text-[12.5px] text-primary">{createState.error}</p>}
        </form>
      )}

      {deleteError && (
        <p className="mb-5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-[12.5px] text-primary">
          {deleteError}
        </p>
      )}

      {playlists.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
          <p className="text-sm font-semibold text-foreground">No playlists yet</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {userId ? "Create your first playlist to start collecting songs." : "Sign in to start collecting songs."}
          </p>
        </div>
      ) : (
        <div
          className="grid gap-[22px]"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}
        >
          {playlists.map((playlist) => {
            const isOwner = Boolean(userId && playlist.ownerId === userId);
            return (
              <article key={playlist.id} className="group relative min-w-0">
                <Link href={`/playlist/${playlist.id}`} className="block">
                  <PlaceholderThumb label="PLAYLIST" className="mb-3 aspect-square w-full rounded-[10px]" />
                  <h2 className="truncate text-[15px] font-semibold text-foreground transition-colors group-hover:text-primary">
                    {playlist.name}
                  </h2>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">
                    {trackLabel(playlist.trackCount)} · by {isOwner ? "You" : playlist.owner}
                  </p>
                </Link>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => handleDelete(playlist)}
                    disabled={isDeleting}
                    className="absolute right-2 top-2 rounded-md border border-border bg-background/85 px-2 py-1 text-[11px] font-medium text-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover:opacity-100 disabled:cursor-wait disabled:opacity-60"
                  >
                    Delete
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
