-- Account-level defaults shared by playlists, Adventure Mode, and song-only playback.
alter table public.profiles
  add column if not exists playback_gap_seconds numeric(4, 1) not null default 1
    check (playback_gap_seconds between 0 and 10),
  add column if not exists playback_fade_out_seconds numeric(4, 1) not null default 1.8
    check (playback_fade_out_seconds between 0 and 10),
  add column if not exists playback_fade_in_seconds numeric(4, 1) not null default 1
    check (playback_fade_in_seconds between 0 and 10),
  add column if not exists playback_cut_audience boolean not null default true;
