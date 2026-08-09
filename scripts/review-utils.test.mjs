import assert from "node:assert/strict";
import test from "node:test";

const { createTimelineDraft, draftChanged, parseTimeInput, validateTimelineDraft } = await import("../lib/review-utils.ts");

const songs = [
  { index: 1, title: "One", clipStart: 10, clipEnd: 100, confidence: 80, suspect: false },
  { index: 2, title: "Two", clipStart: 150, clipEnd: 220, confidence: 80, suspect: false },
];

test("parses timestamp and seconds input", () => {
  assert.equal(parseTimeInput("1:02"), 62);
  assert.equal(parseTimeInput("62.5"), 62.5);
  assert.equal(parseTimeInput("bad"), null);
});

test("carries the existing boundary status into a draft", () => {
  assert.deepEqual(
    createTimelineDraft([{ ...songs[0], suspect: true }]),
    [{ songIndex: 1, clipStart: 10, clipEnd: 100, confirmed: false }],
  );
});

test("requires valid ranges for every song", () => {
  const draft = songs.map((song) => ({ songIndex: song.index, clipStart: song.clipStart, clipEnd: song.clipEnd, confirmed: true }));
  assert.equal(validateTimelineDraft(draft, songs, 240), null);
  assert.match(
    validateTimelineDraft([{ songIndex: 1, clipStart: 100, clipEnd: 90 }, draft[1]], songs, 240),
    /start before its end/,
  );
  assert.match(
    validateTimelineDraft([draft[0]], songs, 240),
    /every song/,
  );
  assert.match(
    validateTimelineDraft([{ ...draft[0], confirmed: undefined }, draft[1]], songs, 240),
    /confirmed or unconfirmed/,
  );
});

test("detects a changed timeline", () => {
  const unchanged = songs.map((song) => ({ songIndex: song.index, clipStart: song.clipStart, clipEnd: song.clipEnd, confirmed: true }));
  assert.equal(draftChanged(unchanged, songs), false);
  assert.equal(draftChanged([{ ...unchanged[0], clipEnd: 105 }, unchanged[1]], songs), true);
});
