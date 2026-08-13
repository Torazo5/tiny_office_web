drop index if exists public.song_requests_one_pending_per_video_idx;
drop index if exists public.song_requests_youtube_video_id_idx;

alter table public.song_requests
  drop column if exists youtube_video_id,
  drop column if exists youtube_title,
  drop column if exists youtube_channel_title,
  drop column if exists youtube_thumbnail_url,
  drop column if exists youtube_published_at;
