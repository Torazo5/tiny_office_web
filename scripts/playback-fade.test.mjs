import assert from "node:assert/strict";
import test from "node:test";

const { equalPowerFadeGain, getBuiltInFadeWindow } = await import("../lib/playback-fade.ts");

const resolvedOverlap = {
  clipStart: 10,
  clipEnd: 20,
  overlapDetected: true,
  fadeOutStart: 17,
  fadeOutEnd: 20,
};

test("built-in fades accept only validated overlap windows", () => {
  assert.deepEqual(getBuiltInFadeWindow(resolvedOverlap, true), { start: 17, end: 20 });
  assert.equal(getBuiltInFadeWindow(resolvedOverlap, false), null);
  assert.equal(getBuiltInFadeWindow({ ...resolvedOverlap, overlapDetected: false }, true), null);
  assert.equal(getBuiltInFadeWindow({ ...resolvedOverlap, fadeOutEnd: 19 }, true), null);
  assert.equal(getBuiltInFadeWindow({ ...resolvedOverlap, fadeOutStart: null, fadeOutEnd: null }, true), null);
});

test("equal-power fade reaches full volume and silence at the endpoints", () => {
  assert.equal(equalPowerFadeGain(0), 1);
  assert.equal(equalPowerFadeGain(1), 0);
  assert.ok(equalPowerFadeGain(0.5) > 0 && equalPowerFadeGain(0.5) < 1);
});
