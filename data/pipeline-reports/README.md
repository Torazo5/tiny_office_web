# Pipeline reports (static snapshot)

Raw copy of every `reports/<video_id>.json` from the `tiny_office` pipeline
repo's `v2_no_audience_variant` batch (199 report JSONs plus
`_mass_pull_summary.json`), as of 2026-08-11. This is the default cut:
song boundaries are tightened to stop before audience applause. Committed
here — not referenced
by path from the other repo — so this repo is self-contained: whoever
builds the backend against it doesn't need filesystem access to a sibling
repo that may not exist in their environment (a cloud coding agent scoped
to just this repo, for instance).

This is the **full raw dataset** underlying the 9 curated performances in
`lib/fixtures/performances.ts` (those are trimmed/typed by hand from a
subset of these files). Use these JSON files to ingest the other ~190
performances, or to build a real ingest pipeline instead of hand-copying
fixtures.

The previous applause-inclusive `refined_v2` snapshot is preserved in
`data/pipeline-reports/with-audience/` and is available in the video-page
cut setting as “With applause · less tight cut”.

Schema, tier logic, and confidence scoring are documented in the pipeline
repo's `PIPELINE.md` — that doc doesn't need to travel with this export,
but the short version: `candidates[].clip_start`/`clip_end` are the
trimmable song boundaries, `confidence.min >= 75` is the "trust without a
review pass" bar, `method === "manual"` means zero candidates (unplayable
until a free-scrub review pass exists — see the main README's "For Codex"
section).

**This will go stale.** It's a snapshot, not a live sync. To refresh:
re-run the pipeline in `tiny_office` (`mass_pull.py` etc.), then re-copy
the default variant's `reports/*.json` over these files. Keep the alternate
snapshot in `with-audience/` when refreshing it. `_mass_pull_summary.json`
is included too, sorted lowest-confidence-first — that's the triage list for
which videos still need a `review.py` pass at the source.
