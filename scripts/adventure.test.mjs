import assert from "node:assert/strict";
import test from "node:test";

const {
  filterAdventureSongOptions,
  isAdventureSongRollable,
} = await import("../lib/adventure.ts");

test("Adventure excludes song clips shorter than one minute", () => {
  const short = { clipStart: 10, clipEnd: 69.99 };
  const exactMinute = { clipStart: 10, clipEnd: 70 };
  const long = { clipStart: 100, clipEnd: 220 };

  assert.equal(isAdventureSongRollable(short), false);
  assert.equal(isAdventureSongRollable(exactMinute), true);
  assert.equal(isAdventureSongRollable(long), true);
  assert.deepEqual(filterAdventureSongOptions([short, exactMinute, long]), [exactMinute, long]);
});
