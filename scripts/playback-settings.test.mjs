import assert from "node:assert/strict";
import test from "node:test";

const {
  DEFAULT_PLAYBACK_SETTINGS,
  PLAYBACK_PRESETS,
  matchingPlaybackPresetId,
} = await import("../lib/playback-settings.ts");

test("default is the default playback configuration", () => {
  const defaultPreset = PLAYBACK_PRESETS.find((preset) => preset.id === "default");
  assert.deepEqual(DEFAULT_PLAYBACK_SETTINGS, defaultPreset.settings);
  assert.equal(matchingPlaybackPresetId(DEFAULT_PLAYBACK_SETTINGS), "default");
  assert.equal(DEFAULT_PLAYBACK_SETTINGS.gapSeconds, 1.5);
  assert.equal(DEFAULT_PLAYBACK_SETTINGS.fadeOutSeconds, 2);
  assert.equal(DEFAULT_PLAYBACK_SETTINGS.builtInFade, false);
});

test("manual settings do not claim a preset", () => {
  assert.equal(
    matchingPlaybackPresetId({ ...DEFAULT_PLAYBACK_SETTINGS, gapSeconds: 0.7 }),
    null,
  );
});
