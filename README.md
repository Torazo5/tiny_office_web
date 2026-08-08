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
| `/playlists` | Playlist library — create, open, and delete playlists |
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

Ratings, review text, and "verified" upload dates remain fixture/mock data.
Playlists are now Supabase-backed, including song/video playlist type and
playlist track membership.

## For Codex: backend integration

**Hard constraint, not a suggestion: Supabase stores metadata only —
timestamps, text, confidence scores, user-generated content (ratings,
reviews, playlists). Never audio or video bytes.** Playback is exclusively
through the YouTube embed (`components/video-embed.tsx`,
`youtube-nocookie.com`) — that's what makes this legal, since it's
YouTube's own official embed rather than a rehost of their content. The
pipeline's source mp3s (`reports/audio/*.mp3` in the `tiny_office` repo)
exist only so YAMNet/ffmpeg can compute boundary timestamps locally —
they're gitignored there and nothing in this repo references them. Don't
add Supabase Storage buckets for audio, don't proxy video through a
Vercel Function, don't cache mp3s anywhere in this stack.

Everything reads through `lib/data.ts` async data functions, including
`getPlaylists`, `getPlaylist`, `getPlaylistSongOptions`, and
`getPlaylistVideoOptions`.
Replace their bodies with real Supabase queries; no page component needs
to change, they already treat this as an async data layer. Table shapes
should follow `lib/types.ts` (`Performance`, `Song`, `Review`, `Playlist`,
`PlaylistTrack`) — that file is the intended schema contract.

Specific gaps to close, roughly in the order they'll bite:

1. **Auth.** The "Sign in" slot in `components/header.tsx` is a disabled
   div. Whatever auth (Clerk, Supabase Auth, etc.) goes here also unlocks
   "Your rating" / "Write a review" / "+ Add to list" on `/video/[id]`,
   currently all inert.
2. **Review-flow writes.** `/review/[id]`'s nudge/confirm/skip/mark-bad
   buttons are disabled placeholders. This screen is
   `scripts/review.py` from the pipeline repo, moved into the browser —
   confirming here should write the same kind of correction that script's
   `reports/<id>.verified.json` output represents, just to a real table
   instead of a file. Needs a Server Action or API route + a schema for
   storing corrections.
3. **Ratings/reviews** — pure product surfaces with no pipeline equivalent,
   build from scratch.
4. **Upload dates.** `Performance.date` is `null` for every fixture — the
   pipeline's yt-dlp call never captured it. Pull it from a real metadata
   source when performances get ingested for real.
5. **Manual-tier videos.** The pipeline flags some videos `method:
   "manual"` (zero candidates — e.g. The Roots feat. Bilal in the real
   dataset) — deliberately excluded from `getPerformances()` /
   `getReviewQueue()` right now, since the review-flow UI assumes existing
   clip candidates to nudge. A manual-tier video needs a different
   free-scrub flow (the pipeline's `scripts/manual_mark.py`, as a UI) that
   doesn't exist here yet.

The video embed and click-to-seek (`components/video-embed.tsx`,
`components/player-context.tsx`) are already real — a live
youtube-nocookie.com iframe, reseeked by clicking a song row. What it
doesn't do: scrub *within* a song (each click is a fresh seek + reload,
not a smooth scrub), track "currently playing" as real playback state, or
persist anything. That's still fair game to improve, just not blocking.

## Ingesting real pipeline output

`data/pipeline-reports/` is a **self-contained snapshot** of every
`reports/<video_id>.json` from the `tiny_office` pipeline repo (53 files,
committed here — no cross-repo filesystem access needed to use them; see
that directory's own README for details and how to refresh it). Once
there's a real `performances` table, that's the ingest source.
`confidence.min >= 75` is the existing "trust without review" bar (used
for `verified` in the fixtures); keep using it unless you have a reason
not to.
