import assert from "node:assert/strict";
import test from "node:test";

const { loadAllSupabasePages, SUPABASE_PAGE_SIZE } = await import("../lib/supabase-pagination.ts");

test("loads every Supabase page when the result reaches the API row limit", async () => {
  const calls = [];
  const pages = [
    Array.from({ length: SUPABASE_PAGE_SIZE }, (_, index) => index),
    [SUPABASE_PAGE_SIZE],
  ];

  const rows = await loadAllSupabasePages("Loading test rows", async (from, to) => {
    calls.push([from, to]);
    return { data: pages.shift() ?? [], error: null };
  });

  assert.equal(rows.length, SUPABASE_PAGE_SIZE + 1);
  assert.deepEqual(calls, [
    [0, SUPABASE_PAGE_SIZE - 1],
    [SUPABASE_PAGE_SIZE, SUPABASE_PAGE_SIZE * 2 - 1],
  ]);
  assert.equal(rows.at(-1), SUPABASE_PAGE_SIZE);
});

test("stops after a short Supabase page", async () => {
  let calls = 0;
  const rows = await loadAllSupabasePages("Loading test rows", async () => {
    calls += 1;
    return { data: ["one", "two"], error: null };
  });

  assert.deepEqual(rows, ["one", "two"]);
  assert.equal(calls, 1);
});

test("preserves the labeled Supabase error", async () => {
  await assert.rejects(
    loadAllSupabasePages("Loading test rows", async () => ({
      data: null,
      error: { message: "connection failed" },
    })),
    { message: "Loading test rows: connection failed" },
  );
});
