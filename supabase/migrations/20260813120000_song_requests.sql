create table if not exists public.song_requests (
  id uuid primary key default gen_random_uuid(),
  query text not null check (char_length(btrim(query)) between 1 and 200),
  youtube_video_id text check (youtube_video_id is null or youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  youtube_title text check (youtube_title is null or char_length(youtube_title) <= 500),
  youtube_channel_title text check (youtube_channel_title is null or char_length(youtube_channel_title) <= 200),
  youtube_thumbnail_url text check (youtube_thumbnail_url is null or char_length(youtube_thumbnail_url) <= 1000),
  youtube_published_at timestamptz,
  note text check (note is null or char_length(note) <= 1000),
  source_path text check (source_path is null or char_length(source_path) <= 300),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'imported', 'rejected')),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists song_requests_status_created_at_idx
  on public.song_requests (status, created_at desc);
create index if not exists song_requests_youtube_video_id_idx
  on public.song_requests (youtube_video_id);
create unique index if not exists song_requests_one_pending_per_video_idx
  on public.song_requests (youtube_video_id)
  where youtube_video_id is not null and status in ('pending', 'in_progress');

alter table public.song_requests enable row level security;

-- Requests are written and reviewed through server-only actions. Do not expose
-- this queue through the public Data API, even when the table is in public.
revoke all on public.song_requests from anon, authenticated;
grant all on public.song_requests to service_role;

drop policy if exists "Song requests are not public" on public.song_requests;
create policy "Song requests are not public"
  on public.song_requests for all to anon, authenticated
  using (false)
  with check (false);
