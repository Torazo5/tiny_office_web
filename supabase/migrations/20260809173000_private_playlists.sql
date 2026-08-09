-- Playlists are account data, not a public catalog. Existing playlists with an
-- owner remain available only to that owner; orphaned legacy rows become
-- inaccessible because they have no account to authorize.
update public.playlists
set visibility = 'private'
where visibility is distinct from 'private';

alter table public.playlists
  alter column visibility set default 'private';

drop policy if exists "Public playlists are readable" on public.playlists;
create policy "Users read their own playlists"
  on public.playlists for select to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "Visible playlist tracks are readable" on public.playlist_tracks;
create policy "Users read their own playlist tracks"
  on public.playlist_tracks for select to authenticated
  using (
    exists (
      select 1 from public.playlists
      where playlists.id = playlist_tracks.playlist_id
        and (select auth.uid()) = playlists.owner_id
    )
  );

revoke select on public.playlists, public.playlist_tracks from anon;
