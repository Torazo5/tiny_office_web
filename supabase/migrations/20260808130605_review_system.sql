create table if not exists public.listening_presets (
  id uuid primary key default gen_random_uuid(),
  performance_video_id text not null references public.performances(video_id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  owner_name text not null default 'Anonymous',
  name text not null check (char_length(trim(name)) between 1 and 80),
  note text check (note is null or char_length(note) <= 1000),
  status text not null default 'published' check (status in ('published', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, performance_video_id)
);

create table if not exists public.listening_preset_songs (
  preset_id uuid not null,
  performance_video_id text not null,
  song_index integer not null,
  clip_start numeric(10, 3) not null check (clip_start >= 0),
  clip_end numeric(10, 3) not null check (clip_end >= 0),
  primary key (preset_id, song_index),
  foreign key (preset_id, performance_video_id)
    references public.listening_presets(id, performance_video_id)
    on delete cascade,
  foreign key (performance_video_id, song_index)
    references public.songs(performance_video_id, song_index)
    on delete cascade
);

create table if not exists public.performance_preset_selections (
  user_id uuid not null references auth.users(id) on delete cascade,
  performance_video_id text not null references public.performances(video_id) on delete cascade,
  preset_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, performance_video_id),
  foreign key (preset_id, performance_video_id)
    references public.listening_presets(id, performance_video_id)
    on delete cascade
);

create table if not exists public.truth_requests (
  id uuid primary key default gen_random_uuid(),
  performance_video_id text not null references public.performances(video_id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  requester_name text not null default 'Anonymous',
  note text check (note is null or char_length(note) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  resolved_by uuid references auth.users(id) on delete set null,
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 1000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (id, performance_video_id)
);

create table if not exists public.truth_request_songs (
  request_id uuid not null,
  performance_video_id text not null,
  song_index integer not null,
  clip_start numeric(10, 3) not null check (clip_start >= 0),
  clip_end numeric(10, 3) not null check (clip_end >= 0),
  primary key (request_id, song_index),
  foreign key (request_id, performance_video_id)
    references public.truth_requests(id, performance_video_id)
    on delete cascade,
  foreign key (performance_video_id, song_index)
    references public.songs(performance_video_id, song_index)
    on delete cascade
);

create table if not exists public.ground_truth_edits (
  id uuid primary key default gen_random_uuid(),
  performance_video_id text not null references public.performances(video_id) on delete cascade,
  song_index integer not null,
  admin_id uuid not null references auth.users(id) on delete restrict,
  request_id uuid references public.truth_requests(id) on delete set null,
  previous_clip_start numeric(10, 3) not null check (previous_clip_start >= 0),
  previous_clip_end numeric(10, 3) not null check (previous_clip_end >= 0),
  next_clip_start numeric(10, 3) not null check (next_clip_start >= 0),
  next_clip_end numeric(10, 3) not null check (next_clip_end >= 0),
  created_at timestamptz not null default now(),
  foreign key (performance_video_id, song_index)
    references public.songs(performance_video_id, song_index)
    on delete cascade
);

create unique index if not exists truth_requests_one_pending_per_user_video_idx
  on public.truth_requests(requester_id, performance_video_id)
  where status = 'pending';
create index if not exists listening_presets_performance_status_idx
  on public.listening_presets(performance_video_id, status, created_at desc);
create index if not exists listening_presets_owner_idx
  on public.listening_presets(owner_id, created_at desc);
create index if not exists truth_requests_status_created_idx
  on public.truth_requests(status, created_at desc);
create index if not exists truth_requests_requester_idx
  on public.truth_requests(requester_id, created_at desc);
create index if not exists ground_truth_edits_performance_created_idx
  on public.ground_truth_edits(performance_video_id, created_at desc);

alter table public.listening_presets enable row level security;
alter table public.listening_preset_songs enable row level security;
alter table public.performance_preset_selections enable row level security;
alter table public.truth_requests enable row level security;
alter table public.truth_request_songs enable row level security;
alter table public.ground_truth_edits enable row level security;

drop policy if exists "Published listening presets are readable" on public.listening_presets;
create policy "Published listening presets are readable"
  on public.listening_presets for select to anon, authenticated
  using (status = 'published' or (select auth.uid()) = owner_id);

drop policy if exists "Users create their own listening presets" on public.listening_presets;
create policy "Users create their own listening presets"
  on public.listening_presets for insert to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Users update their own listening presets" on public.listening_presets;
create policy "Users update their own listening presets"
  on public.listening_presets for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Users delete their own listening presets" on public.listening_presets;
create policy "Users delete their own listening presets"
  on public.listening_presets for delete to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "Published preset songs are readable" on public.listening_preset_songs;
create policy "Published preset songs are readable"
  on public.listening_preset_songs for select to anon, authenticated
  using (exists (
    select 1 from public.listening_presets
    where listening_presets.id = listening_preset_songs.preset_id
      and (listening_presets.status = 'published'
        or (select auth.uid()) = listening_presets.owner_id)
  ));

drop policy if exists "Users manage their own preset songs" on public.listening_preset_songs;
create policy "Users manage their own preset songs"
  on public.listening_preset_songs for all to authenticated
  using (exists (
    select 1 from public.listening_presets
    where listening_presets.id = listening_preset_songs.preset_id
      and (select auth.uid()) = listening_presets.owner_id
  ))
  with check (exists (
    select 1 from public.listening_presets
    where listening_presets.id = listening_preset_songs.preset_id
      and (select auth.uid()) = listening_presets.owner_id
  ));

drop policy if exists "Users manage their preset selections" on public.performance_preset_selections;
create policy "Users manage their preset selections"
  on public.performance_preset_selections for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users read their truth requests" on public.truth_requests;
create policy "Users read their truth requests"
  on public.truth_requests for select to authenticated
  using ((select auth.uid()) = requester_id);

drop policy if exists "Users create their truth requests" on public.truth_requests;
create policy "Users create their truth requests"
  on public.truth_requests for insert to authenticated
  with check ((select auth.uid()) = requester_id);

drop policy if exists "Users delete their pending truth requests" on public.truth_requests;
create policy "Users delete their pending truth requests"
  on public.truth_requests for delete to authenticated
  using ((select auth.uid()) = requester_id and status = 'pending');

drop policy if exists "Users read their truth request songs" on public.truth_request_songs;
create policy "Users read their truth request songs"
  on public.truth_request_songs for select to authenticated
  using (exists (
    select 1 from public.truth_requests
    where truth_requests.id = truth_request_songs.request_id
      and (select auth.uid()) = truth_requests.requester_id
  ));

drop policy if exists "Users create their truth request songs" on public.truth_request_songs;
create policy "Users create their truth request songs"
  on public.truth_request_songs for insert to authenticated
  with check (exists (
    select 1 from public.truth_requests
    where truth_requests.id = truth_request_songs.request_id
      and (select auth.uid()) = truth_requests.requester_id
  ));

drop policy if exists "Users read their own corrections" on public.song_corrections;
create policy "Users read their own corrections"
  on public.song_corrections for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "Public corrections are readable" on public.song_corrections;
revoke select on public.song_corrections from anon;

grant select on public.listening_presets, public.listening_preset_songs to anon, authenticated;
grant insert, update, delete on public.listening_presets, public.listening_preset_songs to authenticated;
grant select, insert, update, delete on public.performance_preset_selections to authenticated;
grant select, insert, delete on public.truth_requests to authenticated;
grant select, insert on public.truth_request_songs to authenticated;
revoke all on public.ground_truth_edits from anon, authenticated;

revoke all on public.listening_presets, public.listening_preset_songs,
  public.performance_preset_selections, public.truth_requests,
  public.truth_request_songs, public.ground_truth_edits from anon, authenticated;
grant select on public.listening_presets, public.listening_preset_songs to anon, authenticated;
grant insert, update, delete on public.listening_presets, public.listening_preset_songs to authenticated;
grant select, insert, update, delete on public.performance_preset_selections to authenticated;
grant select, insert on public.truth_requests, public.truth_request_songs to authenticated;

drop policy if exists "Ground truth audits are private" on public.ground_truth_edits;
create policy "Ground truth audits are private"
  on public.ground_truth_edits for select to anon, authenticated
  using (false);
