-- Keep the live schema aligned with the idempotent social engagement
-- migration. This is separate because the base migration is already applied
-- to the connected project.

create index if not exists listening_progress_performance_video_id_idx
  on public.listening_progress(performance_video_id);

create index if not exists profile_favorites_performance_video_id_idx
  on public.profile_favorites(performance_video_id);

drop policy if exists "Users read their profile favorites" on public.profile_favorites;
