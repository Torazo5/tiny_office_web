-- The tight and applause cuts are independent ground truths. Every revision,
-- request, preset, and saved preset selection must name the target timeline.

alter table public.listening_presets
  add column if not exists variant_key text not null default 'no-audience'
  references public.performance_cut_variants(variant_key);

alter table public.truth_requests
  add column if not exists variant_key text not null default 'no-audience'
  references public.performance_cut_variants(variant_key);

alter table public.ground_truth_edits
  add column if not exists variant_key text not null default 'no-audience'
  references public.performance_cut_variants(variant_key);

alter table public.performance_preset_selections
  add column if not exists variant_key text not null default 'no-audience'
  references public.performance_cut_variants(variant_key);

alter table public.performance_preset_selections
  drop constraint if exists performance_preset_selections_pkey,
  add primary key (user_id, performance_video_id, variant_key);

alter table public.listening_presets
  add constraint listening_presets_id_video_variant_key_unique
  unique (id, performance_video_id, variant_key);

alter table public.performance_preset_selections
  drop constraint if exists performance_preset_selections_preset_id_performance_video_id_fkey,
  add constraint performance_preset_selections_preset_video_variant_fkey
    foreign key (preset_id, performance_video_id, variant_key)
    references public.listening_presets(id, performance_video_id, variant_key)
    on delete cascade;

drop index if exists public.truth_requests_one_pending_per_user_video_idx;
create unique index truth_requests_one_pending_per_user_video_variant_idx
  on public.truth_requests(requester_id, performance_video_id, variant_key)
  where status = 'pending';

create index if not exists listening_presets_performance_variant_status_idx
  on public.listening_presets(performance_video_id, variant_key, status, created_at desc);
create index if not exists truth_requests_variant_status_created_idx
  on public.truth_requests(variant_key, status, created_at desc);

drop function if exists public.create_listening_preset_with_songs(uuid, text, text, text, text, jsonb);
create function public.create_listening_preset_with_songs(
  p_id uuid,
  p_performance_video_id text,
  p_variant_key text,
  p_owner_name text,
  p_name text,
  p_note text,
  p_songs jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if jsonb_typeof(p_songs) <> 'array' then
    raise exception 'Preset songs must be an array' using errcode = '22023';
  end if;
  if not exists (select 1 from public.performance_cut_variants where variant_key = p_variant_key) then
    raise exception 'Unknown ground-truth timeline' using errcode = '22023';
  end if;

  insert into public.listening_presets (
    id, performance_video_id, variant_key, owner_id, owner_name, name, note, status
  )
  values (
    p_id, p_performance_video_id, p_variant_key, caller_id, p_owner_name, p_name, nullif(p_note, ''), 'published'
  );

  insert into public.listening_preset_songs (
    preset_id, performance_video_id, song_index, title, clip_start, clip_end
  )
  select p_id, p_performance_video_id, item.song_index, item.title, item.clip_start, item.clip_end
  from jsonb_to_recordset(p_songs) as item(
    song_index integer, title text, clip_start numeric, clip_end numeric
  );
end;
$$;

drop function if exists public.create_truth_request_with_songs(uuid, text, text, text, jsonb);
create function public.create_truth_request_with_songs(
  p_id uuid,
  p_performance_video_id text,
  p_variant_key text,
  p_requester_name text,
  p_note text,
  p_songs jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if jsonb_typeof(p_songs) <> 'array' then
    raise exception 'Requested songs must be an array' using errcode = '22023';
  end if;
  if not exists (select 1 from public.performance_cut_variants where variant_key = p_variant_key) then
    raise exception 'Unknown ground-truth timeline' using errcode = '22023';
  end if;

  insert into public.truth_requests (
    id, performance_video_id, variant_key, requester_id, requester_name, note, status
  )
  values (
    p_id, p_performance_video_id, p_variant_key, caller_id, p_requester_name, nullif(p_note, ''), 'pending'
  );

  insert into public.truth_request_songs (
    request_id, performance_video_id, song_index, title, clip_start, clip_end
  )
  select p_id, p_performance_video_id, item.song_index, item.title, item.clip_start, item.clip_end
  from jsonb_to_recordset(p_songs) as item(
    song_index integer, title text, clip_start numeric, clip_end numeric
  );
end;
$$;

-- The previous function updated only public.songs (the tight cut). This
-- replacement updates public.songs for no-audience and the variant table for
-- with-audience, while preserving the same atomic audit/request resolution.
drop function if exists public.apply_ground_truth_changes(text, jsonb, jsonb, uuid, uuid, text);
create function public.apply_ground_truth_changes(
  p_performance_video_id text,
  p_variant_key text,
  p_draft jsonb,
  p_removed_song_indexes jsonb,
  p_admin_id uuid,
  p_request_id uuid default null,
  p_resolution_note text default null
)
returns table (all_confirmed boolean, applied_change_count integer)
language plpgsql
security invoker
set search_path = public
as $$
declare
  performance_duration numeric;
  request_status text;
begin
  if jsonb_typeof(p_draft) <> 'array' or jsonb_typeof(p_removed_song_indexes) <> 'array' then
    raise exception 'Timeline draft and removals must be arrays' using errcode = '22023';
  end if;
  if not exists (select 1 from public.performance_cut_variants where variant_key = p_variant_key) then
    raise exception 'Unknown ground-truth timeline' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_draft) as item(
      song_index integer, title text, clip_start numeric, clip_end numeric, confirmed boolean
    ) where item.song_index is null or item.song_index <= 0 or item.title is null
      or char_length(trim(item.title)) = 0 or char_length(trim(item.title)) > 200
      or item.clip_start is null or item.clip_end is null or item.clip_start < 0
      or item.clip_end <= item.clip_start or item.confirmed is null
  ) then
    raise exception 'Timeline draft contains an invalid song' using errcode = '22023';
  end if;
  if exists (
    select item.song_index from jsonb_to_recordset(p_draft) as item(
      song_index integer, title text, clip_start numeric, clip_end numeric, confirmed boolean
    ) group by item.song_index having count(*) > 1
  ) then
    raise exception 'Timeline draft contains duplicate songs' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements_text(p_removed_song_indexes) as removal(song_index)
    where removal.song_index !~ '^[1-9][0-9]*$'
  ) then
    raise exception 'Explicit removal indexes must be positive integers' using errcode = '22023';
  end if;

  select duration into performance_duration
  from public.performances where video_id = p_performance_video_id for update;
  if performance_duration is null then
    raise exception 'Performance not found' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_draft) as item(
      song_index integer, title text, clip_start numeric, clip_end numeric, confirmed boolean
    ) where item.clip_end > performance_duration
  ) then
    raise exception 'Timeline draft exceeds the performance duration' using errcode = '22023';
  end if;

  if p_request_id is not null then
    select status into request_status from public.truth_requests
    where id = p_request_id and performance_video_id = p_performance_video_id and variant_key = p_variant_key
    for update;
    if request_status is distinct from 'pending' then
      raise exception 'Truth request is no longer pending' using errcode = '55000';
    end if;
  end if;

  if p_variant_key = 'no-audience' then
    if exists (
      select 1 from jsonb_array_elements_text(p_removed_song_indexes) as removal(song_index)
      left join public.songs current on current.performance_video_id = p_performance_video_id
        and current.song_index = removal.song_index::integer
      where current.song_index is null
    ) then raise exception 'A removal must name an existing song' using errcode = '22023'; end if;

    with draft as (
      select * from jsonb_to_recordset(p_draft) as item(song_index integer, title text, clip_start numeric, clip_end numeric, confirmed boolean)
    ), removals as (
      select removal.song_index::integer as song_index from jsonb_array_elements_text(p_removed_song_indexes) as removal(song_index)
    ), changes as (
      select current.song_index, 'remove'::text change_type, current.title previous_title, null::text next_title,
        current.clip_start previous_clip_start, current.clip_end previous_clip_end, null::numeric next_clip_start, null::numeric next_clip_end,
        not current.suspect previous_confirmed, null::boolean next_confirmed
      from public.songs current join removals on removals.song_index = current.song_index
      where current.performance_video_id = p_performance_video_id
      union all
      select current.song_index, 'update', current.title, proposed.title, current.clip_start, current.clip_end,
        proposed.clip_start, proposed.clip_end, not current.suspect, proposed.confirmed
      from public.songs current join draft proposed on proposed.song_index = current.song_index
      where current.performance_video_id = p_performance_video_id and (
        current.title is distinct from proposed.title or current.clip_start is distinct from proposed.clip_start
        or current.clip_end is distinct from proposed.clip_end or (not current.suspect) is distinct from proposed.confirmed)
      union all
      select proposed.song_index, 'add', null::text, proposed.title, null::numeric, null::numeric,
        proposed.clip_start, proposed.clip_end, null::boolean, proposed.confirmed
      from draft proposed left join public.songs current on current.performance_video_id = p_performance_video_id and current.song_index = proposed.song_index
      where current.song_index is null
    )
    insert into public.ground_truth_edits (
      performance_video_id, variant_key, song_index, admin_id, request_id, change_type, previous_title, next_title,
      previous_clip_start, previous_clip_end, next_clip_start, next_clip_end, previous_confirmed, next_confirmed
    ) select p_performance_video_id, p_variant_key, song_index, p_admin_id, p_request_id, change_type, previous_title, next_title,
      previous_clip_start, previous_clip_end, next_clip_start, next_clip_end, previous_confirmed, next_confirmed from changes;
    get diagnostics applied_change_count = row_count;

    insert into public.songs (performance_video_id, song_index, title, clip_start, clip_end, confidence, suspect, updated_at)
    select p_performance_video_id, item.song_index, item.title, item.clip_start, item.clip_end,
      coalesce(current.confidence, 0), not item.confirmed, now()
    from jsonb_to_recordset(p_draft) as item(song_index integer, title text, clip_start numeric, clip_end numeric, confirmed boolean)
    left join public.songs current on current.performance_video_id = p_performance_video_id and current.song_index = item.song_index
    on conflict (performance_video_id, song_index) do update set title = excluded.title, clip_start = excluded.clip_start,
      clip_end = excluded.clip_end, suspect = excluded.suspect, updated_at = now();
    delete from public.songs where performance_video_id = p_performance_video_id and song_index in (
      select removal.song_index::integer from jsonb_array_elements_text(p_removed_song_indexes) as removal(song_index)
    );
    select coalesce(bool_and(not suspect), true) into all_confirmed from public.songs where performance_video_id = p_performance_video_id;
    update public.performances set verified = all_confirmed, updated_at = now() where video_id = p_performance_video_id;
  else
    if exists (
      select 1 from jsonb_array_elements_text(p_removed_song_indexes) as removal(song_index)
      left join public.performance_cut_variant_songs current on current.variant_key = p_variant_key
        and current.performance_video_id = p_performance_video_id and current.song_index = removal.song_index::integer
      where current.song_index is null
    ) then raise exception 'A removal must name an existing song' using errcode = '22023'; end if;

    with draft as (
      select * from jsonb_to_recordset(p_draft) as item(song_index integer, title text, clip_start numeric, clip_end numeric, confirmed boolean)
    ), removals as (
      select removal.song_index::integer as song_index from jsonb_array_elements_text(p_removed_song_indexes) as removal(song_index)
    ), changes as (
      select current.song_index, 'remove'::text change_type, current.title previous_title, null::text next_title,
        current.clip_start previous_clip_start, current.clip_end previous_clip_end, null::numeric next_clip_start, null::numeric next_clip_end,
        not current.suspect previous_confirmed, null::boolean next_confirmed
      from public.performance_cut_variant_songs current join removals on removals.song_index = current.song_index
      where current.variant_key = p_variant_key and current.performance_video_id = p_performance_video_id
      union all
      select current.song_index, 'update', current.title, proposed.title, current.clip_start, current.clip_end,
        proposed.clip_start, proposed.clip_end, not current.suspect, proposed.confirmed
      from public.performance_cut_variant_songs current join draft proposed on proposed.song_index = current.song_index
      where current.variant_key = p_variant_key and current.performance_video_id = p_performance_video_id and (
        current.title is distinct from proposed.title or current.clip_start is distinct from proposed.clip_start
        or current.clip_end is distinct from proposed.clip_end or (not current.suspect) is distinct from proposed.confirmed)
      union all
      select proposed.song_index, 'add', null::text, proposed.title, null::numeric, null::numeric,
        proposed.clip_start, proposed.clip_end, null::boolean, proposed.confirmed
      from draft proposed left join public.performance_cut_variant_songs current on current.variant_key = p_variant_key
        and current.performance_video_id = p_performance_video_id and current.song_index = proposed.song_index
      where current.song_index is null
    )
    insert into public.ground_truth_edits (
      performance_video_id, variant_key, song_index, admin_id, request_id, change_type, previous_title, next_title,
      previous_clip_start, previous_clip_end, next_clip_start, next_clip_end, previous_confirmed, next_confirmed
    ) select p_performance_video_id, p_variant_key, song_index, p_admin_id, p_request_id, change_type, previous_title, next_title,
      previous_clip_start, previous_clip_end, next_clip_start, next_clip_end, previous_confirmed, next_confirmed from changes;
    get diagnostics applied_change_count = row_count;

    insert into public.performance_cut_variant_songs (
      variant_key, performance_video_id, song_index, title, clip_start, clip_end, confidence, suspect, updated_at
    ) select p_variant_key, p_performance_video_id, item.song_index, item.title, item.clip_start, item.clip_end,
      coalesce(current.confidence, 0), not item.confirmed, now()
    from jsonb_to_recordset(p_draft) as item(song_index integer, title text, clip_start numeric, clip_end numeric, confirmed boolean)
    left join public.performance_cut_variant_songs current on current.variant_key = p_variant_key
      and current.performance_video_id = p_performance_video_id and current.song_index = item.song_index
    on conflict (variant_key, performance_video_id, song_index) do update set title = excluded.title, clip_start = excluded.clip_start,
      clip_end = excluded.clip_end, suspect = excluded.suspect, updated_at = now();
    delete from public.performance_cut_variant_songs where variant_key = p_variant_key and performance_video_id = p_performance_video_id
      and song_index in (select removal.song_index::integer from jsonb_array_elements_text(p_removed_song_indexes) as removal(song_index));
    select coalesce(bool_and(not suspect), true) into all_confirmed from public.performance_cut_variant_songs
      where variant_key = p_variant_key and performance_video_id = p_performance_video_id;
  end if;

  if p_request_id is not null then
    update public.truth_requests set status = 'approved', resolved_by = p_admin_id,
      resolution_note = nullif(p_resolution_note, ''), resolved_at = now(), updated_at = now()
    where id = p_request_id and performance_video_id = p_performance_video_id and variant_key = p_variant_key and status = 'pending';
    if not found then raise exception 'Truth request is no longer pending' using errcode = '55000'; end if;
  end if;

  return query select all_confirmed, applied_change_count;
end;
$$;

revoke execute on function public.create_listening_preset_with_songs(uuid, text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.create_listening_preset_with_songs(uuid, text, text, text, text, text, jsonb) to authenticated;
revoke execute on function public.create_truth_request_with_songs(uuid, text, text, text, text, jsonb) from public, anon;
grant execute on function public.create_truth_request_with_songs(uuid, text, text, text, text, jsonb) to authenticated;
revoke execute on function public.apply_ground_truth_changes(text, text, jsonb, jsonb, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.apply_ground_truth_changes(text, text, jsonb, jsonb, uuid, uuid, text) to service_role;
