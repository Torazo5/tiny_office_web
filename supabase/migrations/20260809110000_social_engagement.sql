-- User-facing engagement: half-star ratings, one review per performance,
-- listening progress, and the four performances shown on a profile.

alter table public.ratings
  drop constraint if exists ratings_rating_check;

alter table public.ratings
  alter column rating type numeric(2, 1) using rating::numeric(2, 1);

alter table public.ratings
  add constraint ratings_rating_check
  check (rating >= 0.5 and rating <= 5 and mod(rating, 0.5) = 0);

alter table public.reviews
  drop constraint if exists reviews_rating_check;

alter table public.reviews
  alter column rating type numeric(2, 1) using rating::numeric(2, 1);

alter table public.reviews
  add constraint reviews_rating_check
  check (rating >= 0.5 and rating <= 5 and mod(rating, 0.5) = 0);

-- A review is the written form of a user's rating for a performance. The
-- live database currently has no duplicate review groups, so this invariant
-- can be added without deleting any existing user data.
alter table public.reviews
  add constraint reviews_one_per_user_per_performance_key
  unique (performance_video_id, user_id);

create table if not exists public.listening_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  performance_video_id text not null references public.performances(video_id) on delete cascade,
  seconds_listened numeric(12, 3) not null default 0 check (seconds_listened >= 0),
  first_listened_at timestamptz not null default now(),
  last_listened_at timestamptz not null default now(),
  primary key (user_id, performance_video_id)
);

create index if not exists listening_progress_user_last_listened_idx
  on public.listening_progress(user_id, last_listened_at desc);
create index if not exists listening_progress_performance_video_id_idx
  on public.listening_progress(performance_video_id);

create table if not exists public.profile_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  position smallint not null check (position between 1 and 4),
  performance_video_id text not null references public.performances(video_id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, position),
  unique (user_id, performance_video_id)
);

create index if not exists profile_favorites_performance_video_id_idx
  on public.profile_favorites(performance_video_id);

alter table public.listening_progress enable row level security;
alter table public.profile_favorites enable row level security;

drop policy if exists "Users read their listening progress" on public.listening_progress;
create policy "Users read their listening progress"
  on public.listening_progress for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users manage their listening progress" on public.listening_progress;
create policy "Users manage their listening progress"
  on public.listening_progress for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users update their listening progress" on public.listening_progress;
create policy "Users update their listening progress"
  on public.listening_progress for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete their listening progress" on public.listening_progress;
create policy "Users delete their listening progress"
  on public.listening_progress for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users manage their profile favorites" on public.profile_favorites;
create policy "Users manage their profile favorites"
  on public.profile_favorites for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.listening_progress to authenticated;
grant select, insert, update, delete on public.profile_favorites to authenticated;
