<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Delivery discipline

### Major-error log

Record every major error in `docs/engineering-log.md` before closing the
task. A major error is one that blocks a core user flow, local development,
build/deployment, database access, or causes a security/data-integrity risk;
also log an issue after two unsuccessful fix attempts.

Each entry must include the date, symptom and impact, root cause (or the best
evidence if unresolved), files/systems involved, the fix or next action, and
how the result was verified. Do not put secrets, tokens, personal data, or
full environment-variable values in the log.

### Commits

After a meaningful, verified change (feature, bug fix, behavior change,
substantial refactor, configuration/schema change, or a major-error fix),
create a focused local Git commit without asking the user again for approval.
Stage only the files that belong to that change and preserve unrelated user
edits. Use any available scoped Git-write approval needed by the execution
environment. Never push, open a pull request, or otherwise publish the commit
unless the user explicitly asks.

If validation or committing is blocked, explain the blocker and record it in
the major-error log when it qualifies as a major error.

If the agent cannot write Git metadata or create a required commit, it must
tell the user why (for example, a read-only `.git` sandbox) and provide the
exact `git add` and `git commit` commands for the files it changed. Do not
push unless explicitly instructed.

### Scoped command permissions

Keep the normal workspace sandbox enabled. If a required build, development
server, or Git write is blocked by the sandbox, request a one-time elevated
approval for the narrowest exact command instead of switching the whole task
to Full access. Do not assume approval is granted; report a denial or failure
and continue with a safer alternative when possible.

For Git writes, stage explicit paths rather than using `git add .` when the
worktree contains unrelated edits. Before committing, verify
`git diff --cached --check`, `git diff --cached --stat`, and
`git diff --cached --name-only`. Never push, publish, or run destructive Git
commands unless the user explicitly asks.

### Functional verification before commits

Before creating a commit for a code or configuration change, run `npm run
build` when possible. If a production build is not practical for the change,
start `npm run dev` and exercise the affected flow. If the environment blocks
both, record the blocker in `docs/engineering-log.md` and clearly report that
functional verification could not be completed.
