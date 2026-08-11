-- Per-song playback metadata from the v3 smart-overlap no-audience reports.
alter table public.songs
  add column if not exists overlap_detected boolean not null default false,
  add column if not exists fade_out_start numeric(10, 3),
  add column if not exists fade_out_end numeric(10, 3);

alter table public.performance_cut_variant_songs
  add column if not exists overlap_detected boolean not null default false,
  add column if not exists fade_out_start numeric(10, 3),
  add column if not exists fade_out_end numeric(10, 3);

alter table public.songs
  drop constraint if exists songs_fade_window_check,
  add constraint songs_fade_window_check check (
    (fade_out_start is null and fade_out_end is null)
    or (
      fade_out_start >= clip_start
      and fade_out_start < fade_out_end
      and fade_out_end = clip_end
    )
  );

alter table public.performance_cut_variant_songs
  drop constraint if exists performance_cut_variant_songs_fade_window_check,
  add constraint performance_cut_variant_songs_fade_window_check check (
    (fade_out_start is null and fade_out_end is null)
    or (
      fade_out_start >= clip_start
      and fade_out_start < fade_out_end
      and fade_out_end = clip_end
    )
  );
