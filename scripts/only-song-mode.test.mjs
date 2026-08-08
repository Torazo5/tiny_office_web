import assert from "node:assert/strict";
import test from "node:test";

const { findOnlySongModeAction, findOnlySongModeTarget } = await import("../lib/only-song-mode.ts");

const songs = [
  { clipStart: 10, clipEnd: 100 },
  { clipStart: 150, clipEnd: 220 },
  { clipStart: 220, clipEnd: 300 },
];

test("returns the next song start after crossing a meaningful gap", () => {
  assert.equal(findOnlySongModeTarget(songs, 99.5, 100.2), 150);
});

test("does not seek across adjacent clips", () => {
  assert.equal(findOnlySongModeTarget(songs, 219.5, 220.2), null);
});

test("does not react when mode begins during a gap", () => {
  assert.equal(findOnlySongModeTarget(songs, 120, 121), null);
});

test("skips invalid-duration clips as automatic targets", () => {
  const songsWithInvalidClip = [
    { clipStart: 10, clipEnd: 100 },
    { clipStart: 125, clipEnd: 110 },
    { clipStart: 180, clipEnd: 240 },
  ];

  assert.equal(findOnlySongModeTarget(songsWithInvalidClip, 99.5, 100.2), 180);
});

test("does not return a target after the final song", () => {
  assert.equal(findOnlySongModeTarget(songs, 299.5, 300.2), null);
});

test("stops at the end of the final playable song", () => {
  assert.deepEqual(findOnlySongModeAction(songs, 299.5, 300.2), {
    type: "stop",
    end: 300,
  });
});
