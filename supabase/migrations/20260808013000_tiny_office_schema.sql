create table if not exists public.performances (
  video_id text primary key,
  artist text not null,
  date date,
  duration integer not null check (duration >= 0),
  method text not null check (method in ('comments', 'yamnet', 'silence', 'transcript', 'manual')),
  confidence_avg numeric(5, 2) not null default 0 check (confidence_avg between 0 and 100),
  confidence_min numeric(5, 2) not null default 0 check (confidence_min between 0 and 100),
  verified boolean not null default false,
  source_title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  performance_video_id text not null references public.performances(video_id) on delete cascade,
  song_index integer not null check (song_index > 0),
  title text not null,
  clip_start numeric(10, 3) not null check (clip_start >= 0),
  clip_end numeric(10, 3) not null check (clip_end >= 0),
  confidence numeric(5, 2) not null default 0 check (confidence between 0 and 100),
  suspect boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (performance_video_id, song_index)
);

create table if not exists public.ratings (
  performance_video_id text not null references public.performances(video_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (performance_video_id, user_id)
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  performance_video_id text not null references public.performances(video_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default 'Anonymous',
  rating smallint not null check (rating between 1 and 5),
  text text not null check (char_length(text) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.playlists (
  id text primary key,
  name text not null,
  owner_id uuid references auth.users(id) on delete cascade,
  owner_name text not null default 'You',
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.playlist_tracks (
  playlist_id text not null references public.playlists(id) on delete cascade,
  position integer not null check (position > 0),
  performance_video_id text not null references public.performances(video_id) on delete cascade,
  song_index integer not null,
  created_at timestamptz not null default now(),
  primary key (playlist_id, position),
  foreign key (performance_video_id, song_index)
    references public.songs(performance_video_id, song_index)
    on delete cascade
);

create table if not exists public.song_corrections (
  id uuid primary key default gen_random_uuid(),
  performance_video_id text not null references public.performances(video_id) on delete cascade,
  song_index integer not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('nudge_start', 'nudge_end', 'confirm', 'skip', 'mark_bad')),
  clip_start numeric(10, 3) check (clip_start is null or clip_start >= 0),
  clip_end numeric(10, 3) check (clip_end is null or clip_end >= 0),
  note text,
  created_at timestamptz not null default now(),
  foreign key (performance_video_id, song_index)
    references public.songs(performance_video_id, song_index)
    on delete cascade
);

create index if not exists songs_performance_video_id_idx on public.songs(performance_video_id);
create index if not exists reviews_performance_video_id_created_at_idx on public.reviews(performance_video_id, created_at desc);
create index if not exists song_corrections_song_created_at_idx on public.song_corrections(performance_video_id, song_index, created_at desc);
create index if not exists playlist_tracks_performance_idx on public.playlist_tracks(performance_video_id, song_index);

alter table public.performances enable row level security;
alter table public.songs enable row level security;
alter table public.ratings enable row level security;
alter table public.reviews enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_tracks enable row level security;
alter table public.song_corrections enable row level security;

drop policy if exists "Public performances are readable" on public.performances;
create policy "Public performances are readable"
  on public.performances for select to anon, authenticated using (true);

drop policy if exists "Public songs are readable" on public.songs;
create policy "Public songs are readable"
  on public.songs for select to anon, authenticated using (true);

drop policy if exists "Public ratings are readable" on public.ratings;
create policy "Public ratings are readable"
  on public.ratings for select to anon, authenticated using (true);

drop policy if exists "Users manage their own ratings" on public.ratings;
create policy "Users manage their own ratings"
  on public.ratings for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users update their own ratings" on public.ratings;
create policy "Users update their own ratings"
  on public.ratings for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete their own ratings" on public.ratings;
create policy "Users delete their own ratings"
  on public.ratings for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Public reviews are readable" on public.reviews;
create policy "Public reviews are readable"
  on public.reviews for select to anon, authenticated using (true);

drop policy if exists "Users create their own reviews" on public.reviews;
create policy "Users create their own reviews"
  on public.reviews for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users update their own reviews" on public.reviews;
create policy "Users update their own reviews"
  on public.reviews for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete their own reviews" on public.reviews;
create policy "Users delete their own reviews"
  on public.reviews for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Public playlists are readable" on public.playlists;
create policy "Public playlists are readable"
  on public.playlists for select to anon, authenticated
  using (visibility = 'public' or (select auth.uid()) = owner_id);

drop policy if exists "Users create their own playlists" on public.playlists;
create policy "Users create their own playlists"
  on public.playlists for insert to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Users update their own playlists" on public.playlists;
create policy "Users update their own playlists"
  on public.playlists for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Users delete their own playlists" on public.playlists;
create policy "Users delete their own playlists"
  on public.playlists for delete to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "Visible playlist tracks are readable" on public.playlist_tracks;
create policy "Visible playlist tracks are readable"
  on public.playlist_tracks for select to anon, authenticated
  using (
    exists (
      select 1 from public.playlists
      where playlists.id = playlist_tracks.playlist_id
        and (playlists.visibility = 'public' or (select auth.uid()) = playlists.owner_id)
    )
  );

drop policy if exists "Users manage their own playlist tracks" on public.playlist_tracks;
create policy "Users manage their own playlist tracks"
  on public.playlist_tracks for insert to authenticated
  with check (
    exists (
      select 1 from public.playlists
      where playlists.id = playlist_tracks.playlist_id
        and (select auth.uid()) = playlists.owner_id
    )
  );

drop policy if exists "Users delete their own playlist tracks" on public.playlist_tracks;
create policy "Users delete their own playlist tracks"
  on public.playlist_tracks for delete to authenticated
  using (
    exists (
      select 1 from public.playlists
      where playlists.id = playlist_tracks.playlist_id
        and (select auth.uid()) = playlists.owner_id
    )
  );

drop policy if exists "Public corrections are readable" on public.song_corrections;
create policy "Public corrections are readable"
  on public.song_corrections for select to anon, authenticated using (true);

drop policy if exists "Users create their own corrections" on public.song_corrections;
create policy "Users create their own corrections"
  on public.song_corrections for insert to authenticated
  with check ((select auth.uid()) = user_id);

grant select on public.performances, public.songs, public.ratings, public.reviews, public.playlists, public.playlist_tracks, public.song_corrections to anon, authenticated;
grant insert, update, delete on public.ratings, public.reviews, public.playlists, public.playlist_tracks to authenticated;
grant insert on public.song_corrections to authenticated;
