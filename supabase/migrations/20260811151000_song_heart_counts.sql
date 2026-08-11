-- Keep a public aggregate on songs without exposing individual heart records.
alter table public.songs
  add column if not exists heart_count integer not null default 0 check (heart_count >= 0);

update public.songs as song
set heart_count = coalesce(counts.total, 0)
from (
  select performance_video_id, song_index, count(*)::integer as total
  from public.song_hearts
  group by performance_video_id, song_index
) as counts
where song.performance_video_id = counts.performance_video_id
  and song.song_index = counts.song_index;

create or replace function public.sync_song_heart_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.songs
  set heart_count = (
    select count(*)::integer
    from public.song_hearts
    where performance_video_id = coalesce(new.performance_video_id, old.performance_video_id)
      and song_index = coalesce(new.song_index, old.song_index)
  )
  where performance_video_id = coalesce(new.performance_video_id, old.performance_video_id)
    and song_index = coalesce(new.song_index, old.song_index);
  return null;
end;
$$;

revoke execute on function public.sync_song_heart_count() from public, anon, authenticated;

drop trigger if exists sync_song_heart_count_after_insert on public.song_hearts;
create trigger sync_song_heart_count_after_insert
after insert on public.song_hearts
for each row execute function public.sync_song_heart_count();

drop trigger if exists sync_song_heart_count_after_delete on public.song_hearts;
create trigger sync_song_heart_count_after_delete
after delete on public.song_hearts
for each row execute function public.sync_song_heart_count();
