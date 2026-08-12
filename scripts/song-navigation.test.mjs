import assert from "node:assert/strict";
import test from "node:test";

const { findSongNavigationTarget } = await import("../lib/song-navigation.ts");

const songs = [
  { clipStart: 10, clipEnd: 100 },
  { clipStart: 150, clipEnd: 220 },
  { clipStart: 250, clipEnd: 300 },
];

test("next song advances within the current song and across gaps", () => {
  assert.equal(findSongNavigationTarget(songs, 40, "next"), 150);
  assert.equal(findSongNavigationTarget(songs, 120, "next"), 150);
});

test("previous song returns to the prior mapped clip", () => {
  assert.equal(findSongNavigationTarget(songs, 180, "previous"), 10);
  assert.equal(findSongNavigationTarget(songs, 230, "previous"), 150);
});

test("song navigation stops at the ends of the current performance", () => {
  assert.equal(findSongNavigationTarget(songs, 20, "previous"), null);
  assert.equal(findSongNavigationTarget(songs, 280, "next"), null);
});

test("invalid clips are ignored", () => {
  assert.equal(
    findSongNavigationTarget([
      { clipStart: 10, clipEnd: 5 },
      { clipStart: 60, clipEnd: 90 },
    ], 20, "next"),
    60,
  );
});
