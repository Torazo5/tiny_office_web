import type { Song, TimelineDraftSong } from "@/lib/types";

export const TIMELINE_NUDGE_SECONDS = 5;

export type TimelineRequestDecision = "accept" | "keep";

export function formatTimeInput(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export function parseTimeInput(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;
  if (/^\d+(?:\.\d+)?$/.test(normalized)) {
    const seconds = Number(normalized);
    return Number.isFinite(seconds) ? seconds : null;
  }

  const match = normalized.match(/^(\d+):([0-5]?\d)(?:\.(\d+))?$/);
  if (!match) return null;
  const seconds = Number(match[1]) * 60 + Number(match[2]) + Number(`0.${match[3] ?? "0"}`);
  return Number.isFinite(seconds) ? seconds : null;
}

export function createTimelineDraft(songs: Song[]): TimelineDraftSong[] {
  return songs.map((song) => ({
    songIndex: song.index,
    title: song.title,
    clipStart: song.clipStart,
    clipEnd: song.clipEnd,
    confirmed: !song.suspect,
  }));
}

/**
 * Resolve a request draft into the timeline an admin chose to publish.
 * Missing proposed songs represent removals; missing current songs represent
 * additions. The default is to accept the proposed value for every index.
 */
export function applyTimelineRequestDecisions(
  currentSongs: Song[],
  proposedDraft: TimelineDraftSong[],
  decisions: Partial<Record<number, TimelineRequestDecision>>,
): TimelineDraftSong[] {
  const currentByIndex = new Map(currentSongs.map((song) => [song.index, song]));
  const proposedByIndex = new Map(proposedDraft.map((song) => [song.songIndex, song]));
  const indices = [...new Set([
    ...currentSongs.map((song) => song.index),
    ...proposedDraft.map((song) => song.songIndex),
  ])].sort((a, b) => a - b);

  return indices.flatMap((songIndex) => {
    if (decisions[songIndex] === "keep") {
      const current = currentByIndex.get(songIndex);
      return current
        ? [{
            songIndex: current.index,
            title: current.title,
            clipStart: current.clipStart,
            clipEnd: current.clipEnd,
            confirmed: !current.suspect,
          }]
        : [];
    }

    const proposed = proposedByIndex.get(songIndex);
    return proposed ? [proposed] : [];
  });
}

export function validateTimelineDraft(
  draft: TimelineDraftSong[],
  songs: Song[],
  duration: number,
): string | null {
  if (!Array.isArray(draft)) return "Submit a valid song list.";
  if (!Number.isFinite(duration) || duration <= 0) return "This performance has no valid duration.";

  const expected = new Set(songs.map((song) => song.index));
  const maxExistingIndex = songs.reduce((max, song) => Math.max(max, song.index), 0);
  const seen = new Set<number>();
  for (const item of draft) {
    if (
      !Number.isInteger(item.songIndex) ||
      item.songIndex <= 0 ||
      seen.has(item.songIndex) ||
      (!expected.has(item.songIndex) && item.songIndex <= maxExistingIndex)
    ) {
      return "The timeline contains an invalid song.";
    }
    seen.add(item.songIndex);
    if (typeof item.title !== "string" || item.title.trim().length === 0 || item.title.trim().length > 200) {
      return "Every song needs a title up to 200 characters.";
    }
    if (typeof item.confirmed !== "boolean") {
      return "Choose confirmed or unconfirmed for every song boundary.";
    }
    if (
      !Number.isFinite(item.clipStart) ||
      !Number.isFinite(item.clipEnd) ||
      item.clipStart < 0 ||
      item.clipEnd <= item.clipStart ||
      item.clipEnd > duration
    ) {
      return "Every song must have a start before its end and stay within the performance.";
    }
  }

  return null;
}

export function draftChanged(draft: TimelineDraftSong[], songs: Song[]): boolean {
  const draftByIndex = new Map(draft.map((item) => [item.songIndex, item]));
  if (draft.length !== songs.length) return true;

  return songs.some((song) => {
    const item = draftByIndex.get(song.index);
    return !item ||
      song.title !== item.title ||
      song.clipStart !== item.clipStart ||
      song.clipEnd !== item.clipEnd;
  }) || draft.some((item) => !songs.some((song) => song.index === item.songIndex));
}
