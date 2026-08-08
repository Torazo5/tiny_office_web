# Handoff: Tiny Office UI Mockups

## Overview
Tiny Office is an unofficial Tiny Desk companion that turns full concerts into individually playable songs (official YouTube embeds), with ratings, reviews, lists, and discovery — a Spotify + Letterboxd mashup. This bundle covers the core screens' visual design and flows.

## About the Design Files
`Tiny Office Mockups.dc.html` is a **design reference**, not production code. It's a single self-contained HTML/JS prototype (a screen-switcher with mock state, no real backend, no real video/audio). The task is to **recreate these designs in the target codebase's environment** (React, Vue, native, etc. — pick the best fit if none exists yet), using its own component patterns, not by embedding or copying this HTML directly.

## Fidelity
**High-fidelity.** Colors, typography, spacing, and states below are final; recreate pixel-close using the target stack's own component/styling system.

## Screens / Views

### 1. Browse (`/`)
- Header (shared, see below).
- "Browse performances" title + subtitle with concert count.
- Responsive grid, cards min 240px wide, 22px gap.
- Each card: 16:9 thumbnail (placeholder — real thumbnails come from YouTube), confidence dot (top-right, 9px, green `oklch(0.62 0.1 145)` = verified, coral `oklch(0.68 0.17 25)` = needs review) with a soft dark ring, song-count pill (bottom-right, dark translucent bg, white-space:nowrap), artist name (600 14.5px), "Tiny Desk Concert · [date]" (400 12.5px, muted), and a star rating row (filled/empty ★ chars, coral filled / dark-muted empty) + "avg · count" in mono.
- Click a card → Performance detail.

### 2. Performance detail (`/video/[id]`)
- Header (shared) + back-to-browse.
- Two-column layout: left 1.4fr = video embed (16:9 placeholder with center play button) + artist name (700 24px) + concert date line; right 1fr = song list.
- Below the video meta: a ratings bar (border-top/bottom hairline) — "Your rating" label + 5 clickable stars (coral filled up to rating, muted empty), "Write a review" and "+ Add to list" text actions on the right.
- Below that: "Reviews" — stacked rows, each: circular avatar placeholder, username (600 13px), star rating, date (mono, muted), review text (400 13px/1.5).
- Song list (right column): each row = index (mono, muted), confidence dot (green=confirmed, coral=unconfirmed), title (500 13.5px) + "Unconfirmed boundaries" sublabel in coral when unverified, start timestamp (mono), duration (mono, dimmer). Rows are click-to-seek (hover bg `oklch(0.21 0.004 60)`).
- **State variant to implement explicitly**: unverified vs. verified song row (dot color + optional coral sublabel) — this is a real recurring state, not decoration.

### 3. Review queue (`/review`)
- Header (shared). Title + "N performances flagged" subtitle.
- Dense bordered table, no card chrome: header row (mono, uppercase, muted) with columns Performance / Confidence / Why / (action); body rows with hairline top border, confidence % in mono (coral if <70%, else muted gray), "why" free text, "Review →" link (coral) on the right.
- Deliberately **utilitarian/dense** — this is an internal admin worklist for a small trusted team, not a marketing surface. Don't add cards, imagery, or decoration here.
- Row click → Review flow for that item.

### 4. Review flow (`/review/[id]`)
- Header (shared) + progress pill ("Song X of Y") in the header's right side.
- Artist name + "Confirming song boundaries" subtitle.
- Card containing: song title + current clip range (mono), a waveform placeholder (48 bars, varied heights, coral-tinted where the current clip selection overlaps), a thin track below with a coral clip-range highlight, and a 0:00 / total-time scale line.
- Controls row: "← Nudge start" / "Nudge end →" (secondary outline buttons, adjust clip boundaries), spacer, "Mark bad" (text-only, coral), "Skip" (outline), "Confirm" (solid coral, primary — the only solid-fill button in the whole system).
- Footer: "← Previous song" / "Next song →" nav.

### 5. Playlist (user-created, plays songs across performances)
- Header row: 180×180 cover placeholder, "Playlist" mono kicker, title (700 32px), "by You · N songs · total time", a coral circular play button, "+ Add songs" text action.
- Track table: columns # / Title+Artist / From performance / Time. Currently-playing row: title turns coral and an animated 3-bar equalizer icon replaces the index number; row background lightly highlighted. Clicking a row sets it as playing (UI-only in the mock — wire to real playback in the app).

## Shared header (all screens)
Wordmark "Tiny**Office**" (700, "Office" in coral) — placeholder logo, replace with real mark. Search input (pill, dark fill, subtle border). Empty "Sign in" slot (outlined). Back-to-browse arrow link appears on all screens except Browse. Progress pill appears only on the review-flow screen.

## Interactions & Behavior
- Card/row clicks navigate between screens (browse → detail, review queue → review flow).
- Star ratings and confidence dots are click/derived state, not static images.
- Song rows are "click to seek" (should scrub the embedded YouTube player to that timestamp in the real app).
- Waveform nudge buttons shift the clip-range highlight by a small increment; Confirm/Mark bad/Skip are terminal actions per song (advance queue in the real app).
- Playlist row click sets "now playing" and should trigger real audio/video playback keyed to that song's timestamp range within its source video.

## Design Tokens
- Background base: `oklch(0.155 0.004 60)` (near-black, neutral-warm undertone)
- Surface/card fill: `oklch(0.19–0.21 0.004 60)`
- Borders/hairlines: `oklch(0.24–0.28 0.006 60)`
- Text primary: `oklch(0.92–0.96 0.004 60)`; secondary: `oklch(0.5–0.62 0.006 60)`; tertiary/mono labels: `oklch(0.42–0.46 0.006 60)`
- Accent (coral/red — brand + "needs attention" signal): `oklch(0.68 0.17 25)`
- Success/verified (muted green, used only for the confidence dot): `oklch(0.62 0.1 145)`
- Radius: 8–10px on cards/buttons, 50% on avatars/dots/play buttons
- Type: IBM Plex Sans (UI text, headings), IBM Plex Mono (numbers, timestamps, labels, kickers)
- Spacing: 32px page padding, 22px card grid gap, 12–16px internal component gaps

## Assets
All imagery is placeholder (diagonal-stripe pattern + "THUMBNAIL"/"COVER" mono label) — real video thumbnails come from YouTube; playlist cover art is user/generated. No icon set was used; play triangles and dots are drawn with plain CSS shapes, not SVG/icon-font — feel free to swap in a proper icon set in the real build.

## Files
- `Tiny Office Mockups.dc.html` — the full interactive mockup (all 5 screens, switchable via the top "Mockup nav" tabs, which are dev-only chrome and should not ship).
