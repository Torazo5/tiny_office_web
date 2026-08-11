export type PlaybackSettings = {
  /** Silence inserted before the next song begins. */
  gapSeconds: number;
  /** Volume ramp down at the end of a song. */
  fadeOutSeconds: number;
  /** Volume ramp up when the next song begins. */
  fadeInSeconds: number;
  /** Skip mapped applause and spoken interludes when a song map is available. */
  cutAudience: boolean;
  /** Use validated per-song overlap fade windows when the data provides one. */
  builtInFade: boolean;
};

const SEAMLESS_PLAYBACK_SETTINGS: PlaybackSettings = {
  gapSeconds: 0.25,
  fadeOutSeconds: 2.2,
  fadeInSeconds: 1.2,
  cutAudience: true,
  builtInFade: true,
};

export const PLAYBACK_PRESETS = [
  {
    id: "studio",
    name: "Studio-like",
    description: "Tight song cuts with no added gap or fades.",
    settings: { gapSeconds: 0, fadeOutSeconds: 0, fadeInSeconds: 0, cutAudience: true, builtInFade: false },
  },
  {
    id: "live",
    name: "Live-like",
    description: "Keep the room response, with a soft transition between songs.",
    settings: { gapSeconds: 1, fadeOutSeconds: 1.8, fadeInSeconds: 1, cutAudience: false, builtInFade: true },
  },
  {
    id: "seamless",
    name: "Seamless",
    description: "Tight cuts and a short pause for a polished listening flow.",
    settings: SEAMLESS_PLAYBACK_SETTINGS,
  },
] as const satisfies readonly { id: string; name: string; description: string; settings: PlaybackSettings }[];

/** New sessions begin with the recommended seamless transition. */
export const DEFAULT_PLAYBACK_SETTINGS: PlaybackSettings = SEAMLESS_PLAYBACK_SETTINGS;

export function matchingPlaybackPresetId(settings: PlaybackSettings) {
  return PLAYBACK_PRESETS.find((preset) => (
    preset.settings.gapSeconds === settings.gapSeconds
    && preset.settings.fadeOutSeconds === settings.fadeOutSeconds
    && preset.settings.fadeInSeconds === settings.fadeInSeconds
    && preset.settings.cutAudience === settings.cutAudience
    && preset.settings.builtInFade === settings.builtInFade
  ))?.id ?? null;
}

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
    builtInFade: value?.builtInFade === undefined ? DEFAULT_PLAYBACK_SETTINGS.builtInFade : Boolean(value.builtInFade),
  };
}
