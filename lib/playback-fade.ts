export type FadeMetadata = {
  clipStart: number;
  clipEnd: number;
  overlapDetected?: boolean;
  fadeOutStart?: number | null;
  fadeOutEnd?: number | null;
};

export type FadeWindow = {
  start: number;
  end: number;
};

/**
 * Only accept the data contract promised by the smart-overlap reports. A
 * detected overlap without a resolved window remains playable, but it must
 * not invent a fade duration.
 */
export function getBuiltInFadeWindow(
  song: FadeMetadata | null | undefined,
  enabled: boolean,
): FadeWindow | null {
  if (!enabled || !song?.overlapDetected) return null;
  const start = song.fadeOutStart;
  const end = song.fadeOutEnd;
  if (typeof start !== "number" || typeof end !== "number") return null;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < song.clipStart || start >= end) return null;
  if (Math.abs(end - song.clipEnd) > 0.01) return null;
  return { start, end };
}

/** Equal-power fade-out gain, with exact silence at the end. */
export function equalPowerFadeGain(progress: number) {
  const normalized = Math.min(1, Math.max(0, progress));
  return normalized >= 1 ? 0 : Math.cos(normalized * Math.PI / 2);
}

export function fadeDurationFromCurrentTime(
  window: FadeWindow | null,
  currentTime: number,
  fallbackSeconds: number,
) {
  if (!window) return fallbackSeconds;
  return Math.max(0.05, window.end - currentTime);
}
