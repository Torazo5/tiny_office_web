"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { useState, useTransition } from "react";
import { toggleSongHeart } from "@/app/song-hearts/actions";

export function SongHeartButton({
  performanceVideoId,
  songIndex,
  initialHearted = false,
  initialHeartCount = 0,
  isSignedIn,
  returnPath,
  onHeartChange,
}: {
  performanceVideoId: string;
  songIndex: number;
  initialHearted?: boolean;
  initialHeartCount?: number;
  isSignedIn: boolean;
  returnPath: string;
  onHeartChange?: (hearted: boolean) => void;
}) {
  const [hearted, setHearted] = useState(initialHearted);
  const [heartCount, setHeartCount] = useState(initialHeartCount);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isSignedIn) {
    return (
      <Link
        href={{ pathname: "/login", query: { next: returnPath } }}
        aria-label="Sign in to heart this song"
        title="Sign in to heart this song"
        className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
      >
        <Heart aria-hidden className="size-4" />
        <span className="font-mono text-[11px]">{heartCount}</span>
      </Link>
    );
  }

  function handleToggle() {
    const nextHearted = !hearted;
    setError(null);
    startTransition(async () => {
      const result = await toggleSongHeart(performanceVideoId, songIndex, nextHearted);
      if (result?.error) {
        setError(result.error);
        return;
      }
      const updatedHearted = result?.hearted ?? nextHearted;
      setHearted(updatedHearted);
      setHeartCount(result?.heartCount ?? heartCount + (nextHearted ? 1 : -1));
      onHeartChange?.(updatedHearted);
    });
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        aria-pressed={hearted}
        aria-label={hearted ? "Remove heart from this song" : "Heart this song"}
        title={hearted ? "Remove heart" : "Heart this song"}
        className={`inline-flex h-9 items-center gap-1.5 rounded-md px-2 font-mono text-[11px] transition-colors disabled:cursor-wait disabled:opacity-60 ${
          hearted ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
        }`}
      >
        <Heart aria-hidden className={`size-4 ${hearted ? "fill-current" : ""}`} />
        <span>{heartCount}</span>
      </button>
      {error && <span className="sr-only" role="status">{error}</span>}
    </span>
  );
}
