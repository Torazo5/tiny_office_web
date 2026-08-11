-- A private, per-user heart for an individual mapped song clip.
create table if not exists public.song_hearts (
  user_id uuid not null references auth.users(id) on delete cascade,
  performance_video_id text not null,
  song_index integer not null check (song_index > 0),
  created_at timestamptz not null default now(),
  primary key (user_id, performance_video_id, song_index),
  foreign key (performance_video_id, song_index)
    references public.songs(performance_video_id, song_index)
    on delete cascade
);

create index if not exists song_hearts_user_created_at_idx
  on public.song_hearts(user_id, created_at desc);

alter table public.song_hearts enable row level security;

drop policy if exists "Users read their song hearts" on public.song_hearts;
create policy "Users read their song hearts"
  on public.song_hearts for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users heart songs" on public.song_hearts;
create policy "Users heart songs"
  on public.song_hearts for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users remove their song hearts" on public.song_hearts;
create policy "Users remove their song hearts"
  on public.song_hearts for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, delete on public.song_hearts to authenticated;
