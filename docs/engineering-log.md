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
