import "server-only";

import { PERFORMANCES } from "@/lib/fixtures/performances";
import { DEMO_PLAYLIST } from "@/lib/fixtures/playlist";
import type { Performance, Playlist, ReviewQueueItem } from "@/lib/types";

/**
 * DATA SEAM — every function here is async and returns plain data, backed
 * right now by the fixtures in lib/fixtures/. That's deliberate: swap a
 * function body for a Supabase query and no call site (page component)
 * needs to change, because they already treat this as an async data layer.
 *
 * Nothing here does real auth, real playback state, or real writes
 * (ratings/reviews/reorder/nudge-boundary). Those need a backend first.
 */

export async function getPerformances(): Promise<Performance[]> {
  return PERFORMANCES;
}

export async function getPerformance(videoId: string): Promise<Performance | null> {
  return PERFORMANCES.find((p) => p.videoId === videoId) ?? null;
}

/**
 * Videos below the trust threshold (confidence.min < 75, see PIPELINE.md's
 * "for building the app" section) need a human pass before their song
 * boundaries are shown as fact. This is that worklist.
 *
 * Note: pipeline `method === "manual"` videos (zero candidates — e.g. The
 * Roots feat. Bilal in the real dataset) are excluded here on purpose. The
 * review flow UI below assumes existing clip_start/clip_end candidates to
 * nudge; a manual-tier video needs a different free-scrub flow (the
 * scripts/manual_mark.py equivalent) that doesn't exist in this app yet.
 */
export async function getReviewQueue(): Promise<ReviewQueueItem[]> {
  return PERFORMANCES.filter((p) => !p.verified).map((p) => {
    const suspectCount = p.songs.filter((s) => s.suspect).length;
    const whyText =
      suspectCount > 0
        ? `${suspectCount} of ${p.songs.length} song boundaries flagged suspect`
        : `Lowest-confidence song at ${p.confidence.min}%`;
    return {
      videoId: p.videoId,
      artist: p.artist,
      confidencePct: Math.round(p.confidence.avg),
      whyText,
    };
  });
}

/**
 * Single playlist demo, ignores `id` — see lib/fixtures/playlist.ts.
 */
export async function getPlaylist(id: string): Promise<Playlist | null> {
  if (id !== DEMO_PLAYLIST.id) return null;
  return DEMO_PLAYLIST;
}
