/**
 * Picks another performance for continuous playback. The current performance
 * is excluded whenever another eligible video exists, so autoplay cannot get
 * stuck replaying the same video.
 */
export function chooseAutoplayVideoId(
  videoIds: readonly string[],
  currentVideoId: string,
  random: () => number = Math.random,
): string | null {
  const candidates = [...new Set(videoIds.filter((videoId) => videoId && videoId !== currentVideoId))];
  if (candidates.length === 0) return null;

  const index = Math.min(candidates.length - 1, Math.max(0, Math.floor(random() * candidates.length)));
  return candidates[index];
}
