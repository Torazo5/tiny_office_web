# Only Song Mode Design

**Date:** 2026-08-08

## Goal

Add a page-local “Only song mode” switch to the performance player. When the
switch is enabled, playback preserves the user’s current paused/playing state
and automatically skips gaps between song clips as the video plays, without
reloading the YouTube embed.

The separate “no video mode” idea is intentionally out of scope for this
change. It is feasible to explore later as a distraction-free layout around
the official YouTube embed, but the app must not extract, proxy, or rehost
audio. A fully invisible player would also need to be checked against
YouTube’s embedded-player requirements.

## Confirmed behavior

- The mode is off by default and is not persisted beyond the current page.
- Toggling the mode never starts, pauses, or seeks the video.
- If the video is paused, the mode performs no automatic transition.
- If the mode is enabled while the video is in a gap between songs, playback
  continues naturally until the next song begins.
- While actively playing through a song, crossing that song’s `clipEnd` will
  transition to the next playable song when a meaningful gap exists:
  - If the next song begins at or very near the current song’s end, leave the
    player alone and let the video continue naturally.
  - If there is a meaningful gap, seek to the next song’s `clipStart`.
- A manual song-row click continues to use the existing in-place seek and
  preserves whether the player was paused or playing.
- If there is no later playable song, playback is left alone at the end of the
  final song.
- Song entries with non-positive duration (`clipEnd <= clipStart`) are not
  automatic transition targets. They remain visible in the existing list.

## Architecture

The current page already places `VideoEmbed` and `SongRow` under a shared
`PlayerProvider`. The provider will remain the single client-side owner of
player selection state and will additionally expose:

- the performance’s ordered `Song[]` metadata,
- `onlySongMode: boolean`, and
- `setOnlySongMode(enabled: boolean)`.

The server page will pass the performance’s songs into the provider. The
provider will render the existing children unchanged apart from the new mode
control exposed by `VideoEmbed`.

`VideoEmbed` will extend its local YouTube player type with the IFrame API’s
`getCurrentTime()` and `getPlayerState()` methods and subscribe to the player’s
state-change callback. While `onlySongMode` is enabled and the YouTube state is
`playing`, a short interval will sample the current time. A pure helper will
determine whether the previous sample crossed a song boundary and, if so,
return the next clip’s start time only when a real gap exists. The embed will
call `seekTo()` with that start time; because YouTube preserves paused versus
playing state for `seekTo()`, no explicit `playVideo()` call is needed.

The helper will use the ordered song list, ignore invalid-duration entries for
automatic transitions, and use a small fixed near-contiguous tolerance so
timestamp rounding does not create an unnecessary jump.

## UI

Add a compact `aria-pressed` button labeled “Only song mode” in the player
panel, visually indicating whether the mode is active. The control will use
the existing dark-theme tokens and button styling and will not overlay the
YouTube iframe.

## Error handling and lifecycle

- If the YouTube IFrame API cannot load, existing native iframe behavior stays
  available and automatic mode simply has no API-driven transitions.
- The polling interval starts and stops with the mode/player state and is
  cleared during component cleanup.
- Player teardown will continue to destroy the API instance on unmount.
- Repeated polling after a boundary crossing will be prevented by advancing the
  stored previous-time sample after every check.
- Manual seeks and pause/resume actions will update the sampling baseline so a
  user action is not mistaken for a natural playback boundary crossing.

## Testing and verification

Add unit tests for the pure transition helper covering:

1. crossing a song end with a meaningful gap returns the next playable
   `clipStart`;
2. adjacent or overlapping clips return no seek target;
3. entering a song after enabling during a gap does not cause an immediate
   transition;
4. invalid-duration entries are skipped as automatic targets; and
5. a final song produces no transition target.

Run the focused tests, lint, and a production build. Manually verify in the
browser that toggling while paused does not start playback, toggling during a
gap does not jump, song-row clicks preserve playback state, and a real gap
advances to the next song without reloading the iframe.
