"use client";

import Link from "next/link";
import { Heart, Play } from "lucide-react";
import { useState } from "react";
import { SongHeartButton } from "@/components/song-heart-button";
import { YouTubeThumbnail } from "@/components/youtube-thumbnail";
import { formatClipDuration } from "@/lib/format";
import type { LikedSong } from "@/lib/types";

export function LikedSongsList({ songs }: { songs: LikedSong[] }) {
  const [currentSongs, setCurrentSongs] = useState(songs);

  if (currentSongs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
        <Heart aria-hidden className="mx-auto size-8 text-primary/70" />
        <h2 className="mt-4 text-sm font-semibold text-foreground">No liked songs yet</h2>
        <p className="mx-auto mt-1 max-w-[420px] text-[13px] leading-relaxed text-muted-foreground">
          Heart a song while it plays in Adventure mode or from a performance page, and it will show up here.
        </p>
        <Link
          href="/random-pick"
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Find a song <Play aria-hidden className="size-3.5 fill-current" />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {currentSongs.map((song) => (
        <article
          key={`${song.performanceVideoId}:${song.songIndex}`}
          className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-card/50 p-3 transition-colors hover:border-primary/40 sm:gap-4 sm:p-4"
        >
          <Link
            href={`/video/${song.performanceVideoId}?song=${song.songIndex}`}
            className="group flex min-w-0 flex-1 items-center gap-3 sm:gap-4"
          >
            <YouTubeThumbnail
              videoId={song.performanceVideoId}
              alt={`${song.artist} Tiny Desk Concert`}
              className="h-20 w-32 shrink-0 rounded-lg sm:h-24 sm:w-40"
              sizes="(max-width: 640px) 128px, 160px"
            />
            <div className="min-w-0">
              <h2 className="truncate text-[14px] font-semibold text-foreground transition-colors group-hover:text-primary">
                {song.title}
              </h2>
              <p className="mt-1 truncate text-[12.5px] text-muted-foreground">{song.artist}</p>
              <p className="mt-1 truncate text-[11.5px] text-muted-foreground/75">
                {song.performanceLabel} · Song {song.songIndex} · {formatClipDuration(song.clipStart, song.clipEnd)}
              </p>
              <p className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-medium text-primary">
                Play this song <Play aria-hidden className="size-3 fill-current transition-transform group-hover:translate-x-0.5" />
              </p>
            </div>
          </Link>
          <SongHeartButton
            performanceVideoId={song.performanceVideoId}
            songIndex={song.songIndex}
            initialHearted
            initialHeartCount={song.heartCount}
            isSignedIn
            returnPath="/liked-songs"
            onHeartChange={(hearted) => {
              if (!hearted) {
                setCurrentSongs((current) => current.filter((item) => item !== song));
              }
            }}
          />
        </article>
      ))}
    </div>
  );
}
