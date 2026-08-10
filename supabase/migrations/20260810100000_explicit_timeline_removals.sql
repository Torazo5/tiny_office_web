-- Official catalog data is preserved unless an admin submits an explicit
-- removal index. An omitted item in a draft is never a deletion instruction.

drop function if exists public.apply_ground_truth_changes(text, jsonb, uuid, uuid, text);

create function public.apply_ground_truth_changes(
  p_performance_video_id text,
  p_draft jsonb,
  p_removed_song_indexes jsonb,
  p_admin_id uuid,
  p_request_id uuid default null,
  p_resolution_note text default null
)
returns table (
  all_confirmed boolean,
  applied_change_count integer
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  performance_duration numeric;
  request_status text;
begin
  if jsonb_typeof(p_draft) <> 'array' then
    raise exception 'Timeline draft must be an array' using errcode = '22023';
  end if;

  if jsonb_typeof(p_removed_song_indexes) <> 'array' then
    raise exception 'Explicit removal indexes must be an array' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(p_removed_song_indexes) as removal(song_index)
    where removal.song_index !~ '^[1-9][0-9]*$'
  ) then
    raise exception 'Explicit removal indexes must be positive integers' using errcode = '22023';
  end if;

  if exists (
    select removal.song_index
    from jsonb_array_elements_text(p_removed_song_indexes) as removal(song_index)
    group by removal.song_index
    having count(*) > 1
  ) then
    raise exception 'Explicit removal indexes must be unique' using errcode = '22023';
  end if;

  select duration
  into performance_duration
  from public.performances
  where video_id = p_performance_video_id
  for update;

  if performance_duration is null then
    raise exception 'Performance not found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_draft) as item(
      song_index integer,
      title text,
      clip_start numeric,
      clip_end numeric,
      confirmed boolean
    )
    where item.song_index is null
       or item.song_index <= 0
       or item.title is null
       or char_length(trim(item.title)) = 0
       or char_length(trim(item.title)) > 200
       or item.clip_start is null
       or item.clip_end is null
       or item.clip_start < 0
       or item.clip_end <= item.clip_start
       or item.clip_end > performance_duration
       or item.confirmed is null
  ) then
    raise exception 'Timeline draft contains an invalid song' using errcode = '22023';
  end if;

  if exists (
    select item.song_index
    from jsonb_to_recordset(p_draft) as item(
      song_index integer,
      title text,
      clip_start numeric,
      clip_end numeric,
      confirmed boolean
    )
    group by item.song_index
    having count(*) > 1
  ) then
    raise exception 'Timeline draft contains duplicate songs' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(p_removed_song_indexes) as removal(song_index)
    left join public.songs current
      on current.performance_video_id = p_performance_video_id
     and current.song_index = removal.song_index::integer
    where current.song_index is null
  ) then
    raise exception 'A removal must name an existing song' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(p_removed_song_indexes) as removal(song_index)
    join jsonb_to_recordset(p_draft) as proposed(
      song_index integer,
      title text,
      clip_start numeric,
      clip_end numeric,
      confirmed boolean
    ) on proposed.song_index = removal.song_index::integer
  ) then
    raise exception 'A song cannot be updated and removed together' using errcode = '22023';
  end if;

  if p_request_id is not null then
    select status
    into request_status
    from public.truth_requests
    where id = p_request_id
      and performance_video_id = p_performance_video_id
    for update;

    if request_status is distinct from 'pending' then
      raise exception 'Truth request is no longer pending' using errcode = '55000';
    end if;
  end if;

  with draft as (
    select *
    from jsonb_to_recordset(p_draft) as item(
      song_index integer,
      title text,
      clip_start numeric,
      clip_end numeric,
      confirmed boolean
    )
  ),
  removals as (
    select removal.song_index::integer as song_index
    from jsonb_array_elements_text(p_removed_song_indexes) as removal(song_index)
  ),
  changes as (
    select
      current.song_index,
      'remove'::text as change_type,
      current.title as previous_title,
      null::text as next_title,
      current.clip_start as previous_clip_start,
      current.clip_end as previous_clip_end,
      null::numeric as next_clip_start,
      null::numeric as next_clip_end,
      (not current.suspect) as previous_confirmed,
      null::boolean as next_confirmed
    from public.songs current
    join removals on removals.song_index = current.song_index
    where current.performance_video_id = p_performance_video_id

    union all

    select
      current.song_index,
      'update'::text,
      current.title,
      proposed.title,
      current.clip_start,
      current.clip_end,
      proposed.clip_start,
      proposed.clip_end,
      (not current.suspect),
      proposed.confirmed
    from public.songs current
    join draft proposed on proposed.song_index = current.song_index
    where current.performance_video_id = p_performance_video_id
      and (
        current.title is distinct from proposed.title
        or current.clip_start is distinct from proposed.clip_start
        or current.clip_end is distinct from proposed.clip_end
        or (not current.suspect) is distinct from proposed.confirmed
      )

    union all

    select
      proposed.song_index,
      'add'::text,
      null::text,
      proposed.title,
      null::numeric,
      null::numeric,
      proposed.clip_start,
      proposed.clip_end,
      null::boolean,
      proposed.confirmed
    from draft proposed
    left join public.songs current
      on current.performance_video_id = p_performance_video_id
     and current.song_index = proposed.song_index
    where current.song_index is null
  )
  insert into public.ground_truth_edits (
    performance_video_id, song_index, admin_id, request_id, change_type,
    previous_title, next_title, previous_clip_start, previous_clip_end,
    next_clip_start, next_clip_end, previous_confirmed, next_confirmed
  )
  select
    p_performance_video_id, changes.song_index, p_admin_id, p_request_id,
    changes.change_type, changes.previous_title, changes.next_title,
    changes.previous_clip_start, changes.previous_clip_end,
    changes.next_clip_start, changes.next_clip_end,
    changes.previous_confirmed, changes.next_confirmed
  from changes;

  get diagnostics applied_change_count = row_count;

  insert into public.songs (
    performance_video_id, song_index, title, clip_start, clip_end,
    confidence, suspect, updated_at
  )
  select
    p_performance_video_id,
    proposed.song_index,
    proposed.title,
    proposed.clip_start,
    proposed.clip_end,
    coalesce(current.confidence, 0),
    not proposed.confirmed,
    now()
  from jsonb_to_recordset(p_draft) as proposed(
    song_index integer,
    title text,
    clip_start numeric,
    clip_end numeric,
    confirmed boolean
  )
  left join public.songs current
    on current.performance_video_id = p_performance_video_id
   and current.song_index = proposed.song_index
  on conflict (performance_video_id, song_index) do update
    set title = excluded.title,
        clip_start = excluded.clip_start,
        clip_end = excluded.clip_end,
        suspect = excluded.suspect,
        updated_at = now();

  delete from public.songs current
  where current.performance_video_id = p_performance_video_id
    and current.song_index in (
      select removal.song_index::integer
      from jsonb_array_elements_text(p_removed_song_indexes) as removal(song_index)
    );

  select coalesce(bool_and(not suspect), true)
  into all_confirmed
  from public.songs
  where performance_video_id = p_performance_video_id;

  update public.performances
  set verified = all_confirmed,
      updated_at = now()
  where video_id = p_performance_video_id;

  if p_request_id is not null then
    update public.truth_requests
    set status = 'approved',
        resolved_by = p_admin_id,
        resolution_note = nullif(p_resolution_note, ''),
        resolved_at = now(),
        updated_at = now()
    where id = p_request_id
      and performance_video_id = p_performance_video_id
      and status = 'pending';

    if not found then
      raise exception 'Truth request is no longer pending' using errcode = '55000';
    end if;
  end if;

  return query select all_confirmed, applied_change_count;
end;
$$;

revoke execute on function public.apply_ground_truth_changes(text, jsonb, jsonb, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.apply_ground_truth_changes(text, jsonb, jsonb, uuid, uuid, text) to service_role;
