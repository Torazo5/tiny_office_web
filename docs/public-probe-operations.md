# Public Probe Operations

Use this checklist before inviting the first small cohort. It intentionally
focuses on the release-critical configuration in `public-probe-readiness.md`.

## Deployment configuration

- Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
  `SUPABASE_SECRET_KEY`, `ADMIN_PASSWORD`, and `ADMIN_SESSION_SECRET` in the
  hosting environment. Do not expose either server-only value with a
  `NEXT_PUBLIC_` prefix.
- Set `NEXT_PUBLIC_SITE_URL` to the deployed HTTPS origin.
- In Supabase Auth, set that origin as the Site URL and add
  `https://<host>/auth/callback` to the redirect allow-list. Keep only the
  intended preview origin(s) while testing.
- Add a short feedback-form URL as `NEXT_PUBLIC_FEEDBACK_URL`. The header only
  renders the Feedback link when this is set.
- Apply the three `202608101...` migrations before serving the new application
  version. The timeline migration changes the RPC signature and must deploy
  alongside this code.

## RLS and telemetry checks

- Confirm RLS remains enabled on every table in the public schema, including
  `product_events`.
- Confirm `anon` and `authenticated` have no privilege or policy granting
  access to `product_events`; only the server-side service client records
  telemetry.
- Confirm product-event rows contain identifiers and aggregate metadata only:
  no search text, review text, playlist names, email addresses, or tokens.
- Confirm the production account that runs migrations and the service key stay
  server-only.

## Authenticated smoke test

Use a non-production test Google account after deploy:

1. Open the catalog signed out, press **Play a song**, and verify a performance
   and its first song can be reached without signing in.
2. Search for a known artist, use **Load more**, then retry after temporarily
   disabling the network. Confirm there are no duplicate cards and the retry
   state works.
3. Sign in, create a private playlist, add a song, rate a performance, and
   publish a short review.
4. In an admin test account, approve an edit-only request, then separately
   select **Remove song** for an omitted request song. Confirm the first keeps
   the omitted official song and the second creates a `remove` audit entry.
5. Inspect the telemetry table using privileged tooling and verify the expected
   event names arrive without free-form content.
