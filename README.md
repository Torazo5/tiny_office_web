# Tiny Office

An unofficial Tiny Desk companion — turns full concerts into individually
playable songs (official YouTube embeds), with ratings, reviews, lists, and
discovery. Spotify + Letterboxd, for Tiny Desk.

This repo is the **frontend scaffold**: Next.js + Tailwind + shadcn/ui,
styled to match the design handoff, wired to realistic fixture data. There
is no backend yet — see [For Codex](#for-codex-backend-integration) below,
that's the explicit next step.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind v4
- shadcn/ui (`new-york`-derived, custom theme — see `app/globals.css`)
- IBM Plex Sans / IBM Plex Mono (`next/font/google`)
- No state library, no data-fetching library, no auth — nothing to wire out
  when a real backend replaces the data layer

## Running it

```bash
npm install
npm run dev
```

Open http://localhost:3000. Everything renders from fixture data — no
external calls, no env vars required to run it locally.

## Design source

`docs/design-handoff/` — the original design handoff (README + an
interactive HTML prototype) this app was built to match. `README.md` there
has the full token/spacing/typography spec; the `.html` file is a
throwaway prototype, not something this app imports or depends on.

Single dark theme, no light mode — that's a property of the source design,
not an oversight. Don't add a theme toggle without a light-mode design
first.

## Screens

| Route | Screen |
|---|---|
| `/` | Browse — grid of performances |
| `/video/[id]` | Performance detail — embed, song list, ratings, reviews |
| `/review` | Review queue — worklist of performances needing a confirmation pass |
| `/review/[id]?song=N` | Review flow — confirm one song's clip boundaries |
| `/playlist/[id]` | Playlist — cross-performance track list |

## What's real vs. mock

The 9 performances in `lib/fixtures/performances.ts` are **real pipeline
output**, trimmed from the sibling `tiny_office` repo's
`reports/<video_id>.json` files (see that repo's `PIPELINE.md` for how
`clip_start`/`clip_end`/`confidence`/`suspect` are computed). They were
picked to span every confidence tier so every UI state — verified dot,
"Unconfirmed boundaries", suspect flags, review-queue "why" text — has a
genuine example behind it, including two real pipeline artifacts worth
knowing about before you "fix" them:

- Justin Timberlake, song 5 — a spoken interlude misread as a song off a
  garbled comment timestamp. `suspect: true` is correct; that's the
  feature working, not a bug in the fixture.
- Napalm Death, "Dead" — `clip_end < clip_start` (an inverted range). Also
  real pipeline output, also correctly flagged.

Everything else — ratings, review text, playlists, "verified" upload
dates — has **no backend**, so it's plausible-looking mock data. See the
doc comment at the top of `lib/data.ts` for the exact boundary.

## For Codex: backend integration

Everything reads through `lib/data.ts` — four async functions
(`getPerformances`, `getPerformance`, `getReviewQueue`, `getPlaylist`).
Replace their bodies with real Supabase queries; no page component needs
to change, they already treat this as an async data layer. Table shapes
should follow `lib/types.ts` (`Performance`, `Song`, `Review`, `Playlist`,
`PlaylistTrack`) — that file is the intended schema contract.

Specific gaps to close, roughly in the order they'll bite:

1. **Auth.** The "Sign in" slot in `components/header.tsx` is a disabled
   div. Whatever auth (Clerk, Supabase Auth, etc.) goes here also unlocks
   "Your rating" / "Write a review" / "+ Add to list" on `/video/[id]`,
   currently all inert.
2. **Real video player.** `/video/[id]`'s embed is a static placeholder.
   Once it's a real YouTube iframe, wire `components/song-row.tsx` to seek
   it to `song.clipStart` on click — that's the one interaction the design
   explicitly calls out as "click to seek."
3. **Review-flow writes.** `/review/[id]`'s nudge/confirm/skip/mark-bad
   buttons are disabled placeholders. This screen is
   `scripts/review.py` from the pipeline repo, moved into the browser —
   confirming here should write the same kind of correction that script's
   `reports/<id>.verified.json` output represents, just to a real table
   instead of a file. Needs a Server Action or API route + a schema for
   storing corrections.
4. **Ratings/reviews/playlists tables** — pure product surfaces, no
   pipeline equivalent, build from scratch.
5. **Upload dates.** `Performance.date` is `null` for every fixture — the
   pipeline's yt-dlp call never captured it. Pull it from a real metadata
   source when performances get ingested for real.
6. **Manual-tier videos.** The pipeline flags some videos `method:
   "manual"` (zero candidates — e.g. The Roots feat. Bilal in the real
   dataset) — deliberately excluded from `getPerformances()` /
   `getReviewQueue()` right now, since the review-flow UI assumes existing
   clip candidates to nudge. A manual-tier video needs a different
   free-scrub flow (the pipeline's `scripts/manual_mark.py`, as a UI) that
   doesn't exist here yet.

## Ingesting real pipeline output

Once there's a real `performances` table, `reports/<video_id>.json` in the
sibling `tiny_office` repo is the ingest source — see that repo's
`PIPELINE.md` for the full JSON schema. `confidence.min >= 75` is the
existing "trust without review" bar (used for `verified` in the fixtures);
keep using it unless you have a reason not to.
# tiny_office_web
