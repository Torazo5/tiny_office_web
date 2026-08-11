import assert from "node:assert/strict";
import test from "node:test";

const {
  equalPowerFadeGain,
  getBuiltInFadeWindow,
  specialFadeOutGain,
} = await import("../lib/playback-fade.ts");

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

test("special fade-out reaches silence with a short tail", () => {
  assert.equal(specialFadeOutGain(0, 2), 1);
  assert.ok(specialFadeOutGain(0.5, 2) > 0 && specialFadeOutGain(0.5, 2) < 1);
  assert.equal(specialFadeOutGain(0.85, 2), 0);
  assert.equal(specialFadeOutGain(0.9, 2), 0);
  assert.equal(specialFadeOutGain(1, 2), 0);
  assert.equal(specialFadeOutGain(0, 0.2), 1);
  assert.ok(specialFadeOutGain(0.99, 0.2) > 0);
  assert.equal(specialFadeOutGain(1, 0.2), 0);
});
