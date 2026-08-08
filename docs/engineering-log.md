# Engineering log

Use this file for major errors and their outcomes. Do not include secrets,
tokens, personal data, or full environment-variable values.

## Entry template

### YYYY-MM-DD — Short incident title

- **Symptom and impact:** What failed and what it blocked.
- **Root cause / evidence:** Confirmed cause, or the best evidence collected
  when the issue remains unresolved.
- **Systems and files:** Relevant services, routes, commands, and file paths.
- **Resolution / next action:** The applied fix or the next required action.
- **Verification:** Commands, tests, deployment state, or manual steps that
  confirmed the result.

### 2026-08-08 — Review workflow Node verification blocked by WSL1

- **Symptom and impact:** The new review editor, preset flow, and admin
  Server Actions could not be validated with the repository's Node-based
  tests, lint, or production build commands in this shell.
- **Root cause / evidence:** `npm test`, `npx tsc --noEmit`, and `npm run lint`
  all stopped before starting Node with `WSL 1 is not supported` and
  `Could not determine Node.js install directory`. The bundled Windows Node
  executable also failed through WSL interop with `UtilBindVsockAnyPort`.
- **Systems and files:** WSL1 Node/npm interop, `app/review/`,
  `components/revision-editor.tsx`, `lib/review-data.ts`, and the new review
  utility tests.
- **Resolution / next action:** Run the focused tests, lint, TypeScript check,
  production build, and browser flows from WSL2 or another Linux Node runtime.
- **Verification:** `git diff --check` passed. The connected Supabase project
  accepted all review migrations; table introspection, grants, policies, and
  Supabase security advisors were checked successfully apart from the
  pre-existing Auth leaked-password-protection warning.

### 2026-08-08 — Song playlist picker runtime validation blocked

- **Symptom and impact:** The new per-song playlist picker could not be
  exercised in the local Next.js app before commit.
- **Root cause / evidence:** Both `npm run build` and the required fallback
  `npm run dev` stop before startup with `WSL 1 is not supported` and
  `Could not determine Node.js install directory`.
- **Systems and files:** WSL1 Node.js runtime, `app/video/[id]/page.tsx`,
  `components/add-to-playlist-button.tsx`, and the existing Supabase playlist
  actions.
- **Resolution / next action:** Run the production build and click a song's
  Add to playlist control from WSL2 or the deployment environment.
- **Verification:** `git diff --check` passed; a live Supabase read confirmed
  the signed-in user has a `songs` playlist available to the picker.

### 2026-08-08 — Browse card build blocked by malformed JSX

- **Symptom and impact:** The production build failed during parsing with
  `Unterminated regexp literal` in `components/performance-card.tsx`, blocking
  deployment of the browse-card playlist action.
- **Root cause / evidence:** The card refactor left an extra closing `</div>`
  after the optional rating block, so Turbopack parsed the following JSX as
  invalid source.
- **Systems and files:** Next.js 16.3.0 Turbopack and
  `components/performance-card.tsx`.
- **Resolution / next action:** Removed the unmatched closing element. The
  repository now also requires a build or dev-flow check before commits.
- **Verification:** `git diff --check` passed. Both `npm run build` and
  `npm run dev` were attempted but are blocked before startup by the WSL1 Node
  runtime; rerun the build from WSL2 or the deployment environment.

### 2026-08-08 — Production build blocked by conflicting YouTube player types

- **Symptom and impact:** The production build compiled successfully but
  failed TypeScript validation in `components/playlist-player.tsx` because the
  inferred YouTube player lacked `loadVideoById`, `pauseVideo`, and `playVideo`.
- **Root cause / evidence:** `components/video-embed.tsx` globally augmented
  `Window.YT` with a narrower player type. The playlist player intersected that
  global type with its fuller local type, producing an incompatible constructor
  result.
- **Systems and files:** Next.js TypeScript validation,
  `components/video-embed.tsx`, and `components/playlist-player.tsx`.
- **Resolution / next action:** Aligned the global YouTube player contract with
  the full IFrame API methods used by both components.
- **Verification:** `git diff --check` passed. The production build should be
  rerun in the deployment environment; this WSL1 shell cannot start the local
  Node toolchain.

### 2026-08-08 — OAuth signup returned users away from playlists

- **Symptom and impact:** After Google signup/sign-in, users were returned to
  the browse home page and could no longer see the playlist list they had been
  using.
- **Root cause / evidence:** `components/login-form.tsx` hardcoded the OAuth
  callback destination to `next=/`. Supabase logs showed the playlist query
  succeeding before authentication, successful OAuth completion, and no
  playlist query after the redirect because the user landed on `/`.
- **Systems and files:** Google OAuth redirect construction,
  `app/login/page.tsx`, `app/auth/callback/route.ts`, and the playlists link.
- **Resolution / next action:** Preserve a safe return path through the login
  page and callback, defaulting direct login to `/playlists`; use the browser's
  current origin for OAuth redirects so a stale site URL cannot send users to a
  different host.
- **Verification:** `git diff --check` passed; Supabase auth logs showed the
  affected user's OAuth callback and playlist REST request both completing with
  successful status codes. Node lint remains unavailable in this WSL1 shell.

### 2026-08-08 — Playlist page blocked by unapplied playlist-type migration

- **Symptom and impact:** The playlists page failed at runtime with
  `Loading playlists: column playlists.playlist_type does not exist`, blocking
  playlist loading and the new song/video playlist flow.
- **Root cause / evidence:** The local
  `supabase/migrations/20260808090000_playlist_types.sql` migration existed,
  but the connected Supabase project migration history stopped before it and
  its live `public.playlists` table had no `playlist_type` column.
- **Systems and files:** Supabase `public.playlists` and
  `public.playlist_tracks`, `lib/data.ts`, and the playlist-types migration.
- **Resolution / next action:** Applied the existing `playlist_types` migration
  to the connected project. No application-code fallback was needed.
- **Verification:** Supabase migration history now includes `playlist_types`;
  SQL checks confirmed `playlists.playlist_type` is non-null with a `songs`
  default, the songs/videos constraint exists, and
  `playlist_tracks.song_index` is nullable.

### 2026-08-08 — Song/video playlist live validation blocked

- **Symptom and impact:** The new playlist player and playlist-type migration
  could not be exercised in a running Next.js app, so live YouTube switching
  and Supabase create/add/remove behavior remain unverified here.
- **Root cause / evidence:** The same WSL1 Node interop failure recurred when
  running `npm run lint` and `npx tsc --noEmit`: `WSL 1 is not supported` and
  `UtilBindVsockAnyPort ... socket failed 1`.
- **Systems and files:** WSL1 Node.js runtime, `components/playlist-player.tsx`,
  playlist server actions, and the playlist-type Supabase migration.
- **Resolution / next action:** Run the checks and browser flow from WSL2 or a
  Linux Node runtime after applying the new Supabase migration.
- **Verification:** `git diff --check` and trailing-whitespace checks passed;
  Node-based lint/typecheck could not start.

### 2026-08-08 — Playlist validation blocked by WSL Node launcher

- **Symptom and impact:** `npm run lint` and `npx tsc --noEmit` could not run,
  so automated validation of the playlist changes is unavailable in this
  shell.
- **Root cause / evidence:** The shell is running under WSL1. Both the npm
  shim and the available Windows Node executables failed before starting with
  `WSL ... UtilBindVsockAnyPort ... socket failed 1` and
  `WSL 1 is not supported`.
- **Systems and files:** WSL1 command interop, the Node.js runtime, and the
  playlist route/action/component files in this change.
- **Resolution / next action:** Run lint, TypeScript, and the Next.js dev
  server from WSL2 or another Linux Node runtime, then browser-check create,
  add, remove, and delete playlist flows.
- **Verification:** `git diff --check` passed; a thread terminal was not
  attached and no dev server could be started from this environment.

### 2026-08-08 — Local app startup blocked

- **Symptom and impact:** `npm run dev` could not start because the local
  Next.js launcher lacked execute permission; after dependencies were rebuilt,
  the app stopped on missing Supabase public environment variables.
- **Root cause / evidence:** Dependencies had been installed with incompatible
  executable permissions for the WSL environment. `.env.local` did not define
  `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- **Systems and files:** WSL Node.js dependencies, `.env.local`, and
  `lib/supabase/server.ts`.
- **Resolution / next action:** Reinstall dependencies inside WSL, then set the
  two public Supabase connection values locally and in the production host's
  environment settings.
- **Verification:** The user confirmed the updated song-seeking behavior works
  after local startup was restored.

### 2026-08-08 — Spec commit initially blocked by read-only Git metadata

- **Symptom and impact:** The normal Git command for the required approved
  only-song-mode design-spec commit failed, temporarily leaving the spec
  uncommitted.
- **Root cause / evidence:** `git add --
  docs/superpowers/specs/2026-08-08-only-song-mode-design.md` failed with
  `fatal: Unable to create '/home/torazo/code/tiny-office-web/.git/index.lock':
  Read-only file system`.
- **Systems and files:** Git metadata under `.git`,
  `docs/superpowers/specs/2026-08-08-only-song-mode-design.md`, and
  `docs/engineering-log.md`.
- **Resolution / next action:** Used the bundled Git executable with a scoped
  safe-directory override to commit the spec as `51888cc`.
- **Verification:** The spec passed `git diff --check`; the commit attempt
  reproduced the read-only Git metadata error, and `git log` later confirmed
  the successful `docs: specify only song mode` commit.

### 2026-08-08 — Production build blocked by native dependency mismatch

- **Symptom and impact:** The production Next.js build could not complete, so
  a full build verification of the only-song-mode change is unavailable.
- **Root cause / evidence:** The external Windows Node runtime loaded the
  project’s Linux dependency tree and failed to resolve
  `lightningcss.win32-x64-msvc.node` while evaluating `app/globals.css`.
  The repository contains Linux Lightning CSS binaries, not the Windows
  native binding required by that runtime.
- **Systems and files:** Next.js 16 Turbopack, Tailwind/PostCSS processing,
  `node_modules/lightningcss`, and `app/globals.css`.
- **Resolution / next action:** Run the build with a Linux/WSL Node runtime,
  or reinstall dependencies in the same environment as the runtime used for
  the build so the matching Lightning CSS optional dependency is present.
- **Verification:** TypeScript compilation, ESLint, and the five focused
  only-song-mode tests passed; `next build` reproduced the missing Windows
  Lightning CSS module error.

### 2026-08-08 — Full-video playlist validation blocked by WSL1 Node launcher

- **Symptom and impact:** The focused tests, lint, and production build for
  full-video playlist gap skipping could not start, so the changed player and
  Supabase data path remain statically reviewed but not runtime-verified here.
- **Root cause / evidence:** `npm test`, `npm run lint`, and `npm run build`
  all stopped before Node.js startup with `WSL 1 is not supported` and
  `Could not determine Node.js install directory`.
- **Systems and files:** WSL1 Node.js/npm launcher, `components/playlist-player.tsx`,
  `lib/data.ts`, and the playlist type definitions.
- **Resolution / next action:** Run the focused tests, lint, production build,
  and a browser playback check from WSL2 or another Linux Node.js runtime.
- **Verification:** `git diff --check` passed; no application command reached
  its test, lint, or build phase in this shell.

### 2026-08-08 — Full-video playlist commit blocked by read-only Git metadata

- **Symptom and impact:** The required focused local commit could not be
  created through the normal Git executable, leaving the verified source
  changes unstaged.
- **Root cause / evidence:** `git add` failed before staging with
  `fatal: Unable to create '/home/torazo/code/tiny-office-web/.git/index.lock':
  Read-only file system`.
- **Systems and files:** Git metadata under `.git` and the full-video playlist
  changes in `components/playlist-player.tsx`, `lib/data.ts`, the playlist
  types, fixture, detail component, and engineering log.
- **Resolution / next action:** Retry with the environment’s scoped Git-write
  workaround; if it remains unavailable, run the exact Git commands below
  from a writable checkout.
- **Verification:** The failed `git add` left no files staged; the working-tree
  diff continues to pass `git diff --check`.

### 2026-08-08 — Thumbnail system runtime validation blocked by WSL1 Node launcher

- **Symptom and impact:** The new YouTube thumbnail component and playlist
  thumbnail data path could not be validated with the project test, lint, or
  production build commands in this shell.
- **Root cause / evidence:** `npm test`, `npm run lint`, and `npm run build`
  all stopped before Node.js startup with `WSL 1 is not supported` and
  `Could not determine Node.js install directory`.
- **Systems and files:** WSL1 Node.js/npm launcher, `components/youtube-thumbnail.tsx`,
  `components/performance-card.tsx`, playlist components, `lib/data.ts`, and
  `next.config.ts`.
- **Resolution / next action:** Run the checks and browser-check the YouTube
  thumbnail load and fallback behavior from WSL2 or another Linux Node.js
  runtime.
- **Verification:** `git diff --check` passed; no application command reached
  its test, lint, or build phase in this shell.

### 2026-08-08 — Final-song playback validation blocked by WSL1 Node launcher

- **Symptom and impact:** The final-song stop and playlist handoff behavior
  could not be exercised with the focused tests, lint, or production build in
  this shell.
- **Root cause / evidence:** `npm test`, `npm run lint`, and `npm run build`
  stopped before Node.js startup with `WSL 1 is not supported` and
  `Could not determine Node.js install directory`.
- **Systems and files:** WSL1 Node.js/npm launcher, `lib/only-song-mode.ts`,
  `components/video-embed.tsx`, `components/playlist-player.tsx`, and the
  focused helper tests.
- **Resolution / next action:** Run the focused tests and browser-check the
  standalone stop and multi-item playlist handoff from WSL2 or another Linux
  Node.js runtime.
- **Verification:** `git diff --check` passed; no application command reached
  its test, lint, or build phase in this shell.

### 2026-08-08 — Revision video playback validation blocked by WSL1 Node launcher

- **Symptom and impact:** The new revision editor YouTube embed and clip
  playback controls could not be exercised with the production build or a
  browser flow in this shell.
- **Root cause / evidence:** `npm run build` stopped before Node.js startup
  with `WSL 1 is not supported` and `Could not determine Node.js install
  directory`.
- **Systems and files:** WSL1 Node.js/npm launcher,
  `components/revision-video-player.tsx`, and
  `components/revision-editor.tsx`.
- **Resolution / next action:** Run the production build and browser-check
  current-clip playback, seeking, and song switching from WSL2 or another
  Linux Node.js runtime.
- **Verification:** `git diff --check` passed; the build did not reach the
  application compilation phase in this shell.
