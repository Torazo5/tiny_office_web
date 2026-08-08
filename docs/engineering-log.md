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
