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
create a focused local Git commit. Stage only the files that belong to that
change and preserve unrelated user edits. Never push, open a pull request, or
otherwise publish the commit unless the user explicitly asks.

If validation or committing is blocked, explain the blocker and record it in
the major-error log when it qualifies as a major error.

If the agent cannot write Git metadata or create a required commit, it must
tell the user why (for example, a read-only `.git` sandbox) and provide the
exact `git add` and `git commit` commands for the files it changed. Do not
push unless explicitly instructed.
