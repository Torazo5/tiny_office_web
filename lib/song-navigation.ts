import type { SongClip } from "@/lib/only-song-mode";

export type SongNavigationDirection = "next" | "previous";

function isWithinSong(song: SongClip, currentTime: number) {
  return currentTime >= song.clipStart && currentTime < song.clipEnd;
}

/**
 * Finds the mapped song boundary a manual previous/next-song action should
 * target without leaving the current performance.
 */
export function findSongNavigationTarget(
  songs: readonly SongClip[],
  currentTime: number,
  direction: SongNavigationDirection,
): number | null {
  const playableSongs = songs.filter((song) => song.clipEnd > song.clipStart);
  if (playableSongs.length === 0) return null;

  const currentSongIndex = playableSongs.findIndex((song) => isWithinSong(song, currentTime));

  if (direction === "next") {
    const nextSongIndex = currentSongIndex >= 0
      ? currentSongIndex + 1
      : playableSongs.findIndex((song) => song.clipStart > currentTime);
    return playableSongs[nextSongIndex]?.clipStart ?? null;
  }

  if (currentSongIndex >= 0) {
    return playableSongs[currentSongIndex - 1]?.clipStart ?? null;
  }

  let previousSongIndex = -1;
  for (let index = 0; index < playableSongs.length; index += 1) {
    if (playableSongs[index].clipStart >= currentTime) break;
    previousSongIndex = index;
  }
  return playableSongs[previousSongIndex]?.clipStart ?? null;
}
