import assert from "node:assert/strict";
import test from "node:test";

const {
  DEFAULT_PLAYBACK_SETTINGS,
  PLAYBACK_PRESETS,
  matchingPlaybackPresetId,
} = await import("../lib/playback-settings.ts");

test("seamless is the default playback configuration", () => {
  const seamless = PLAYBACK_PRESETS.find((preset) => preset.id === "seamless");
  assert.deepEqual(DEFAULT_PLAYBACK_SETTINGS, seamless.settings);
  assert.equal(matchingPlaybackPresetId(DEFAULT_PLAYBACK_SETTINGS), "seamless");
  assert.equal(DEFAULT_PLAYBACK_SETTINGS.gapSeconds, 2.5);
  assert.equal(DEFAULT_PLAYBACK_SETTINGS.fadeOutSeconds, 2);
  assert.equal(DEFAULT_PLAYBACK_SETTINGS.builtInFade, true);
});

test("manual settings do not claim a preset", () => {
  assert.equal(
    matchingPlaybackPresetId({ ...DEFAULT_PLAYBACK_SETTINGS, gapSeconds: 0.7 }),
    null,
  );
});
