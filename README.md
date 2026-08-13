# Tiny Office

Tiny Office is an unofficial Tiny Desk companion: official YouTube concerts,
individually playable by song, with ratings, reviews, playlists, discovery,
and community timeline corrections.

The app is a Next.js frontend backed by Supabase. Supabase stores metadata and
user data only—timestamps, song titles, confidence values, ratings, reviews,
playlists, profiles, listening progress, and review submissions. Video and
audio playback stays inside the official `youtube-nocookie.com` embed.

## Stack

- Next.js 16 App Router and React 19
- TypeScript, Tailwind CSS v4, and shadcn/ui primitives
- Supabase Auth, Postgres, Row Level Security, and Server Actions
- YouTube IFrame Player API for seeking and playlist playback
- IBM Plex Sans and IBM Plex Mono from `next/font/google`

## Run locally

Install dependencies and create a local environment file:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The app reads its catalog and user data from Supabase; it does not silently
fall back to the files in `lib/fixtures/`. A working local environment needs a
Supabase project with the checked-in migrations applied and the catalog seeded.

Required public variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

The pipeline seed script also needs the server-only secret key:

```bash
SUPABASE_SECRET_KEY=
```

For local seeding, put this alongside the public Supabase variables in
`.env.local`; `npm run seed:pipeline` loads that file automatically.

Never expose `SUPABASE_SECRET_KEY`, `ADMIN_PASSWORD`, or
`ADMIN_SESSION_SECRET` through a `NEXT_PUBLIC_` variable.

## Routes

| Route | Purpose |
|---|---|
| `/` | Browse and search performances |
| `/artists/[slug]` | Crawlable artist pages with linked Tiny Desk concerts |
| `/concerts/[slug]` | Crawlable concert pages with descriptions and setlists |
| `/video/[id]` | YouTube performance player, song timeline, ratings, reviews, and presets |
| `/playlists` | Signed-in user playlist library |
| `/playlist/[id]` | Song or full-video playlist with playback controls |
| `/adventure` | Random song-clips or full-performance listening |
| `/profile` | Public profile settings, top-four favorites, listening stats, and reviews |
| `/review` | Password-protected admin queue and preset moderation |
| `/review/[id]` | Timeline editor for presets, truth requests, and main-truth updates |
| `/login` | Google or email/password sign-in and account creation |

## Product behavior

### Playback

- Every video is played through the official YouTube embed.
- Clicking a song seeks the shared player to that song's start boundary.
- Performance pages support play/pause, seeking, skip controls, and “Only song mode.”
- Playlist pages support previous/next, shuffle, loop, seeking, and gap skipping for full-video playlists.
- Listening progress is recorded for signed-in users and feeds profile stats.

### Community and review data

- Signed-in users can save half-star ratings and one written review per performance.
- Reviews show public profile labels, generated avatars, and likes.
- Users can publish listening presets without changing official ground truth.
- Users can submit timeline changes for admin review.
- Admins can edit titles and boundaries, add or remove songs, confirm boundaries,
  resolve requests, moderate presets, and retain an audit history.
- Playlists are account-private. Both the app ownership checks and the
  `private_playlists` migration must be active before launch.

## Database setup

The `supabase/migrations/` directory is the schema source of truth. Apply all
migrations in order, including the private-playlist and transactional-write
migrations, through the approved Supabase deployment workflow.

The checked-in pipeline snapshot in `data/pipeline-reports/` contains the
default no-audience cut (299 source report JSON files plus
`_mass_pull_summary.json`). The previous applause-inclusive cut is preserved
under `data/pipeline-reports/with-audience/` for the 199 overlapping videos;
the 100 no-audience-only videos have no applause-inclusive cut. Seed or
refresh both cuts with:

```bash
npm run seed:pipeline
```

That command upserts the default performances and songs, refreshes both cut
variants, and removes stale pipeline rows. The reports are a snapshot, not a
live sync; refresh them from the pipeline repository before running the seed
again.

## Admin configuration

The review dashboard requires a signed-in account plus these server-only
variables:

```bash
ADMIN_PASSWORD=
ADMIN_SESSION_SECRET=
```

The password is checked only in a Server Action. The signed admin session is
HttpOnly, bound to the Supabase user, and expires after eight hours.

Song request search is optional and uses the server-only YouTube Data API v3
key below. Without it, the public manual request form still works:

```bash
YOUTUBE_DATA_API_KEY=
```

The key is never exposed to the browser. YouTube search results only identify
candidate videos; the existing pipeline still needs to produce song-boundary
reports before a request is added to the public catalog.

## Pipeline data and known limits

The runtime catalog comes from the Supabase `performances` and `songs` tables.
The checked-in report snapshot is the ingestion source and is deliberately
kept separate from user drafts and public main truth.

Known limitations:

- Upload dates are not populated by the current pipeline snapshot.
- Manual reports are included in Browse/Search when present in the seeded
  catalog. Their boundaries remain the pipeline's supplied values and should
  be reviewed before treating them as fully verified.
- Playback is provider-controlled. The app can seek and constrain playback,
  but it does not host, proxy, or persist YouTube media.
- The design is intentionally dark-only; there is no light theme.

## Validation and release checklist

Run the local checks before publishing:

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Also verify the Google OAuth redirect URLs, the email/password provider with
Confirm email disabled, Supabase migrations and RLS policies, catalog seed,
admin access, private playlist access, review writes, timeline approval, and
YouTube playback in a browser. The app includes shared
loading, error, and not-found states, but a production browser smoke pass is
still required.

## Design source

`docs/design-handoff/` contains the original design handoff and interactive
prototype. The prototype is reference material only; the production UI uses
the app's own React components and data layer.
