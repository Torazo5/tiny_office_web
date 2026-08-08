"use client";

import { usePlayer } from "@/components/player-context";

/**
 * Real YouTube embed (youtube-nocookie.com — no tracking cookies until
 * playback starts). Reloads the iframe with a new `start` param when a
 * song row is clicked; that's a real seek, not a fake one, but it does
 * mean playback pauses/resets on each click rather than a smooth scrub —
 * fine for "jump to this song," not for scrubbing within one song.
 */
export function VideoEmbed({ videoId }: { videoId: string }) {
  const { startAt } = usePlayer();
  return (
    <div className="relative aspect-video rounded-[10px] overflow-hidden mb-4 border border-border bg-black">
      <iframe
        key={Math.floor(startAt)}
        className="absolute inset-0 w-full h-full"
        src={`https://www.youtube-nocookie.com/embed/${videoId}?start=${Math.floor(startAt)}&rel=0`}
        title="Tiny Desk Concert"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
