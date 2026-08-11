import assert from "node:assert/strict";
import test from "node:test";

const { fuzzySearch } = await import("../lib/fuzzy-search.ts");

const performances = [
  { artist: "Taylor Swift", title: "Taylor Swift: NPR Music Tiny Desk Concert", songs: ["Lover"] },
  { artist: "Adele", title: "Adele: NPR Music Tiny Desk Concert", songs: ["Someone Like You"] },
  { artist: "Lewis Capaldi", title: "Lewis Capaldi: Tiny Desk Concert", songs: ["Heavenly Kind of State of Mind"] },
];

function text(performance) {
  return `${performance.artist} ${performance.title} ${performance.songs.join(" ")}`;
}

test("matches prefixes and small spelling mistakes", () => {
  assert.equal(fuzzySearch(performances, "taylr", text)[0].artist, "Taylor Swift");
  assert.equal(fuzzySearch(performances, "capldi", text)[0].artist, "Lewis Capaldi");
  assert.equal(fuzzySearch(performances, "heaven", text)[0].artist, "Lewis Capaldi");
});

test("matches query words in any order and ranks the closest result first", () => {
  assert.equal(fuzzySearch(performances, "swift taylor", text)[0].artist, "Taylor Swift");
  assert.deepEqual(fuzzySearch(performances, "not-a-real-performance", text), []);
});
