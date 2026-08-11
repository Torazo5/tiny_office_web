-- Keep newly created profiles aligned with the current playback controls.
alter table public.profiles
  alter column playback_gap_seconds set default 2.5,
  alter column playback_fade_out_seconds set default 2.0;
