import assert from "node:assert/strict";
import test from "node:test";

const { chooseAutoplayVideoId } = await import("../lib/autoplay.ts");

test("autoplay chooses a different video", () => {
  assert.equal(chooseAutoplayVideoId(["current", "next", "third"], "current", () => 0), "next");
  assert.equal(chooseAutoplayVideoId(["current", "next", "third"], "current", () => 0.99), "third");
});

test("autoplay de-duplicates candidates and stops when no other video exists", () => {
  assert.equal(chooseAutoplayVideoId(["current", "next", "next"], "current", () => 0.5), "next");
  assert.equal(chooseAutoplayVideoId(["current", "current"], "current"), null);
});
