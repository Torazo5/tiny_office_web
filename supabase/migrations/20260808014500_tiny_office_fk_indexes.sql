create index if not exists ratings_user_id_idx on public.ratings(user_id);
create index if not exists reviews_user_id_idx on public.reviews(user_id);
create index if not exists playlists_owner_id_idx on public.playlists(owner_id);
create index if not exists song_corrections_user_id_idx on public.song_corrections(user_id);
