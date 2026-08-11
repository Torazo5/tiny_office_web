-- Smart-overlap playback uses report-provided fade windows by default.
alter table public.profiles
  add column if not exists playback_built_in_fade boolean not null default true;
