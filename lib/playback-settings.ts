export type PlaybackSettings = {
  /** Silence inserted before the next song begins. */
  gapSeconds: number;
  /** Volume ramp down at the end of a song. */
  fadeOutSeconds: number;
  /** Volume ramp up when the next song begins. */
  fadeInSeconds: number;
  /** Skip mapped applause and spoken interludes when a song map is available. */
  cutAudience: boolean;
};

export const DEFAULT_PLAYBACK_SETTINGS: PlaybackSettings = {
  gapSeconds: 1,
  fadeOutSeconds: 1.8,
  fadeInSeconds: 1,
  cutAudience: true,
};

export const PLAYBACK_PRESETS = [
  {
    id: "studio",
    name: "Studio-like",
    description: "Tight song cuts with no added gap or fades.",
    settings: { gapSeconds: 0, fadeOutSeconds: 0, fadeInSeconds: 0, cutAudience: true },
  },
  {
    id: "live",
    name: "Live-like",
    description: "Keep the room response, with a soft transition between songs.",
    settings: { gapSeconds: 1, fadeOutSeconds: 1.8, fadeInSeconds: 1, cutAudience: false },
  },
  {
    id: "seamless",
    name: "Seamless",
    description: "Tight cuts and a short pause for a polished listening flow.",
    settings: { gapSeconds: 0.25, fadeOutSeconds: 2.2, fadeInSeconds: 1.2, cutAudience: true },
  },
] as const satisfies readonly { id: string; name: string; description: string; settings: PlaybackSettings }[];

function readSeconds(value: unknown, fallback: number, maximum: number) {
  const seconds = typeof value === "number" ? value : Number(value);
  return Number.isFinite(seconds) ? Math.min(maximum, Math.max(0, seconds)) : fallback;
}

export function normalizePlaybackSettings(value: Partial<PlaybackSettings> | null | undefined): PlaybackSettings {
  return {
    gapSeconds: readSeconds(value?.gapSeconds, DEFAULT_PLAYBACK_SETTINGS.gapSeconds, 10),
    fadeOutSeconds: readSeconds(value?.fadeOutSeconds, DEFAULT_PLAYBACK_SETTINGS.fadeOutSeconds, 10),
    fadeInSeconds: readSeconds(value?.fadeInSeconds, DEFAULT_PLAYBACK_SETTINGS.fadeInSeconds, 10),
    cutAudience: value?.cutAudience === undefined ? DEFAULT_PLAYBACK_SETTINGS.cutAudience : Boolean(value.cutAudience),
  };
}
