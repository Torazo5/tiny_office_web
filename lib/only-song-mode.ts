export type SongClip = {
  clipStart: number;
  clipEnd: number;
};

const NEAR_CONTIGUOUS_GAP_SECONDS = 0.75;

/**
 * Returns the next playable clip start when playback crossed a song boundary
 * and there is a meaningful gap before the next song. A null result means the
 * player should be left alone, either because no boundary was crossed or the
 * next song is already adjacent to the current one.
 */
export function findOnlySongModeTarget(
  songs: readonly SongClip[],
  previousTime: number,
  currentTime: number,
): number | null {
  if (currentTime <= previousTime) return null;

  const playableSongs = songs.filter((song) => song.clipEnd > song.clipStart);

  for (let index = 0; index < playableSongs.length - 1; index += 1) {
    const currentSong = playableSongs[index];
    const nextSong = playableSongs[index + 1];

    if (previousTime >= currentSong.clipEnd || currentTime < currentSong.clipEnd) {
      continue;
    }

    const gapSeconds = nextSong.clipStart - currentSong.clipEnd;
    return gapSeconds > NEAR_CONTIGUOUS_GAP_SECONDS ? nextSong.clipStart : null;
  }

  return null;
}
