-- Privacy-preserving product telemetry for the limited public probe. The
-- browser sends only whitelisted metadata; free-form content is never stored.
create table if not exists public.product_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null check (event_name in (
    'landing_viewed', 'performance_opened', 'search_submitted', 'catalog_load_more',
    'song_play_started', 'adventure_started', 'playlist_created', 'item_added_to_playlist',
    'rating_saved', 'review_published', 'sign_in_started', 'sign_in_completed', 'error_shown'
  )),
  occurred_at timestamptz not null default now(),
  route text,
  source text,
  performance_video_id text,
  song_index integer,
  adventure_mode text,
  result_count integer,
  load_more_page integer,
  query_length integer,
  error_category text,
  visitor_id uuid,
  session_id uuid
);

create index if not exists product_events_name_occurred_at_idx
  on public.product_events (event_name, occurred_at desc);
create index if not exists product_events_visitor_occurred_at_idx
  on public.product_events (visitor_id, occurred_at desc);

alter table public.product_events enable row level security;
revoke all on public.product_events from anon, authenticated;
grant insert on public.product_events to service_role;
