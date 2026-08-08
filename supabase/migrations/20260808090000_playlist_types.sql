alter table public.playlists
  add column if not exists playlist_type text not null default 'songs';

alter table public.playlists
  drop constraint if exists playlists_playlist_type_check;

alter table public.playlists
  add constraint playlists_playlist_type_check
  check (playlist_type in ('songs', 'videos'));

alter table public.playlist_tracks
  alter column song_index drop not null;
