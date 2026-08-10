# Tiny Office Public Probe Readiness

**Date:** 2026-08-10  
**Purpose:** Prepare Tiny Office for a small public/customer-probing release.

This is intentionally a prototype release. The immediate goal is to learn whether
people understand the product, find the listening experience useful, and return
to use it. Broader public-launch completeness such as full SEO, legal pages, and
large-scale moderation is intentionally deferred until the product proves demand.

## Release priorities

### 1. Fix timeline approval data integrity

There is a real bug in the admin timeline-request flow. If a submitted request
omits an existing song, the current resolution logic can treat that omission as
an instruction to delete the song—even when the admin did not choose to remove
it.

The safe product rule should be:

> Omitted songs are preserved by default. Removing a song requires an explicit
> removal decision.

The admin review experience should make the diff clear:

- edited songs;
- added songs;
- unchanged songs; and
- songs proposed for removal.

The database transaction should enforce the same rule as the UI so a malformed
or incomplete client submission cannot remove official catalog data.

Acceptance criteria:

- An omitted unchanged song remains in the final timeline.
- An explicitly removed song is removed.
- Edited songs retain the submitted edit.
- New songs are added correctly.
- Mixed add/edit/remove requests produce the exact admin-approved result.
- The audit history records each removal explicitly.
- The review utility tests pass, including the mixed-decision case.

### 2. Make validation green

Before inviting customers, the project should have a clean validation baseline:

- `npm test` passes.
- `npm run lint` has zero errors and zero warnings.
- `npx tsc --noEmit` passes.
- The production build passes using the same build path used by deployment.

The current lint problems include synchronous state updates inside effects in the
revision player and truth-request notification, plus unused symbols. Resolve
these as behavior-preserving cleanup, then rerun the complete suite.

The Webpack production build currently passes. The default Turbopack build hit a
local child-process permission error, so the deployment build path must still be
verified in the actual hosting environment.

## Progressive catalog loading

The current home page renders the full catalog in one response. The production
probe response was approximately 490 KB of HTML, which is unnecessary for the
first visit and makes the product feel like a catalogue before it feels like a
listening experience.

The preferred direction is progressive loading:

1. Render a small curated first batch of performances immediately.
2. Keep the first viewport focused on the product promise and a clear first
   listening action.
3. Load the next batch through a visible “Load more” action or an intentional
   infinite-scroll boundary.
4. Use matching card skeletons while additional cards load.
5. Preserve search, deep links, and empty states while loading more results.
6. Avoid requiring sign-in before the first listen.

The first batch should prioritize the fastest path to the product aha moment:

> Pick a song from a full Tiny Desk concert and start listening immediately.

This does not need to become a large tutorial. A compact inline introduction,
one featured or curated performance, and a direct “Play a song” action should be
enough. After the first play, guide the user toward one next action: play another
song, save it, rate it, or start an adventure.

Success criteria:

- The first meaningful card and first playable performance appear faster than
  they do today.
- Initial HTML and catalog work are materially smaller than the current full
  catalogue response.
- Users can still search the complete catalog.
- Loading more never duplicates or loses cards.
- Slow or failed catalog loading produces a useful retry state.

## Analytics for product learning

Analytics should help answer whether the product is understandable and useful,
not merely report page views. Track the funnel:

`landing → performance opened → first play → second song → adventure or save → sign-in → return visit`

Recommended events:

- `performance_opened`
- `search_submitted`
- `catalog_load_more`
- `song_play_started`
- `adventure_started`
- `playlist_created`
- `item_added_to_playlist`
- `rating_saved`
- `review_published`
- `sign_in_started`
- `sign_in_completed`
- `error_shown`

Useful properties include route, source surface, song/performance identifiers,
adventure mode, result count, load-more page, and error category. Do not send
review text, playlist names, emails, auth tokens, or raw free-form user content.
For search, prefer query length and result count over the raw query.

The first metrics to watch are:

- time to first playable action;
- percentage of visitors who start a song;
- percentage who play a second song;
- adventure-start rate;
- playlist-save and rating rates;
- sign-in conversion after meaningful use; and
- return visits after the first session.

Bounce rate is useful, but the stronger question is: **did the visitor reach the
first listening moment?**

## Customer-probe scope

For this release, the focus is a small, observable cohort rather than a fully
polished public launch. Keep the following in scope:

- the two correctness fixes above;
- progressive initial catalog loading;
- analytics and error visibility;
- production Supabase/RLS/auth configuration;
- a short authenticated browser smoke test; and
- a simple way to collect customer feedback.

Defer larger public-launch work until early feedback justifies it. Revisit SEO,
legal/support surfaces, formal moderation, account deletion, and broader
operational hardening before scaling beyond the probe cohort.

## Suggested sequence

1. Fix the timeline resolution rule and tests.
2. Clear lint and confirm the deployment build path.
3. Implement the progressive catalog strategy.
4. Add the analytics funnel and error events.
5. Run the authenticated smoke test with test accounts.
6. Invite a small group, observe behavior, and use the data to decide what to
   improve next.
