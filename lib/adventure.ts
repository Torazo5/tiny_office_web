export const MIN_ADVENTURE_SONG_DURATION_SECONDS = 60;

type AdventureSongCandidate = {
  clipStart: number;
  clipEnd: number;
};

/** Keep unreliable micro-clips out of the automatic Adventure queue. */
export function isAdventureSongRollable(song: AdventureSongCandidate) {
  const duration = song.clipEnd - song.clipStart;
  return Number.isFinite(duration) && duration >= MIN_ADVENTURE_SONG_DURATION_SECONDS;
}

export function filterAdventureSongOptions<T extends AdventureSongCandidate>(songs: readonly T[]) {
  return songs.filter(isAdventureSongRollable);
}
