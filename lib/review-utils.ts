import type { Song, TimelineDraftSong } from "@/lib/types";

export const TIMELINE_NUDGE_SECONDS = 5;

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
    clipStart: song.clipStart,
    clipEnd: song.clipEnd,
  }));
}

export function validateTimelineDraft(
  draft: TimelineDraftSong[],
  songs: Song[],
  duration: number,
): string | null {
  if (!Array.isArray(draft) || draft.length !== songs.length) {
    return "Include one timeline range for every song in this performance.";
  }
  if (!Number.isFinite(duration) || duration <= 0) return "This performance has no valid duration.";

  const expected = new Set(songs.map((song) => song.index));
  const seen = new Set<number>();
  for (const item of draft) {
    if (!Number.isInteger(item.songIndex) || !expected.has(item.songIndex) || seen.has(item.songIndex)) {
      return "The timeline contains an invalid song.";
    }
    seen.add(item.songIndex);
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
  return draft.some((item) => {
    const song = songs.find((candidate) => candidate.index === item.songIndex);
    return song && (song.clipStart !== item.clipStart || song.clipEnd !== item.clipEnd);
  });
}
