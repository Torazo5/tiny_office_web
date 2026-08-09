-- Revision drafts can contain songs that are not in the pipeline's original
-- song list, and can omit songs that the reviewer does not want to keep.
alter table public.listening_preset_songs
  add column if not exists title text;

update public.listening_preset_songs preset_song
set title = songs.title
from public.songs
where songs.performance_video_id = preset_song.performance_video_id
  and songs.song_index = preset_song.song_index
  and preset_song.title is null;

update public.listening_preset_songs
set title = 'Untitled song'
where title is null;

alter table public.listening_preset_songs
  alter column title set default 'Untitled song',
  alter column title set not null;

alter table public.listening_preset_songs
  drop constraint if exists listening_preset_songs_performance_video_id_song_index_fkey;

alter table public.truth_request_songs
  add column if not exists title text;

update public.truth_request_songs request_song
set title = songs.title
from public.songs
where songs.performance_video_id = request_song.performance_video_id
  and songs.song_index = request_song.song_index
  and request_song.title is null;

update public.truth_request_songs
set title = 'Untitled song'
where title is null;

alter table public.truth_request_songs
  alter column title set default 'Untitled song',
  alter column title set not null;

alter table public.truth_request_songs
  drop constraint if exists truth_request_songs_performance_video_id_song_index_fkey;

alter table public.ground_truth_edits
  drop constraint if exists ground_truth_edits_performance_video_id_song_index_fkey,
  alter column previous_clip_start drop not null,
  alter column previous_clip_end drop not null,
  alter column next_clip_start drop not null,
  alter column next_clip_end drop not null,
  alter column previous_confirmed drop not null,
  alter column next_confirmed drop not null,
  add column if not exists previous_title text,
  add column if not exists next_title text,
  add column if not exists change_type text not null default 'update';

alter table public.ground_truth_edits
  add constraint ground_truth_edits_change_type_check
  check (change_type in ('update', 'add', 'remove'));

alter table public.listening_preset_songs
  add constraint listening_preset_songs_title_length_check
  check (char_length(trim(title)) between 1 and 200);

alter table public.truth_request_songs
  add constraint truth_request_songs_title_length_check
  check (char_length(trim(title)) between 1 and 200);
