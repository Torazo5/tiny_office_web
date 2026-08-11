-- Keep newly created profiles aligned with the current Default playback preset.
alter table public.profiles
  alter column playback_gap_seconds set default 1.5,
  alter column playback_built_in_fade set default false;
