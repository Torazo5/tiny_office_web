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
