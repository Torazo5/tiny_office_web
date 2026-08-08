export type SongClip = {
  clipStart: number;
  clipEnd: number;
};

const NEAR_CONTIGUOUS_GAP_SECONDS = 0.75;

export type OnlySongModeAction =
  | { type: "seek"; start: number }
  | { type: "stop"; end: number }
  | null;

/**
 * Returns the playback action when playback crosses a song boundary. The
 * final playable song produces a stop action so callers can end playback at
 * its clip end instead of playing the non-song content after it.
 */
export function findOnlySongModeAction(
  songs: readonly SongClip[],
  previousTime: number,
  currentTime: number,
): OnlySongModeAction {
  if (currentTime <= previousTime) return null;

  const playableSongs = songs.filter((song) => song.clipEnd > song.clipStart);

  for (let index = 0; index < playableSongs.length; index += 1) {
    const currentSong = playableSongs[index];

    if (previousTime >= currentSong.clipEnd || currentTime < currentSong.clipEnd) {
      continue;
    }

    const nextSong = playableSongs[index + 1];
    if (!nextSong) return { type: "stop", end: currentSong.clipEnd };

    const gapSeconds = nextSong.clipStart - currentSong.clipEnd;
    return gapSeconds > NEAR_CONTIGUOUS_GAP_SECONDS
      ? { type: "seek", start: nextSong.clipStart }
      : null;
  }

  return null;
}

/**
 * Backwards-compatible target-only helper for callers that only need a seek.
 */
export function findOnlySongModeTarget(
  songs: readonly SongClip[],
  previousTime: number,
  currentTime: number,
): number | null {
  const action = findOnlySongModeAction(songs, previousTime, currentTime);
  return action?.type === "seek" ? action.start : null;
}
