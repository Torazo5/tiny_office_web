-- Keep related user and admin writes atomic. Each function either completes
-- every write or Postgres rolls the whole operation back.

create or replace function public.save_review_with_rating(
  p_performance_video_id text,
  p_rating numeric,
  p_text text,
  p_display_name text
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

  if not exists (
    select 1 from public.performances where video_id = p_performance_video_id
  ) then
    raise exception 'Performance not found' using errcode = 'P0002';
  end if;

  insert into public.reviews (
    performance_video_id,
    user_id,
    display_name,
    rating,
    text,
    updated_at
  )
  values (
    p_performance_video_id,
    caller_id,
    p_display_name,
    p_rating,
    p_text,
    now()
  )
  on conflict (performance_video_id, user_id) do update
    set display_name = excluded.display_name,
        rating = excluded.rating,
        text = excluded.text,
        updated_at = now();

  insert into public.ratings (
    performance_video_id,
    user_id,
    rating,
    updated_at
  )
  values (
    p_performance_video_id,
    caller_id,
    p_rating,
    now()
  )
  on conflict (performance_video_id, user_id) do update
    set rating = excluded.rating,
        updated_at = now();
end;
$$;

create or replace function public.create_listening_preset_with_songs(
  p_id uuid,
  p_performance_video_id text,
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

  insert into public.listening_presets (
    id,
    performance_video_id,
    owner_id,
    owner_name,
    name,
    note,
    status
  )
  values (
    p_id,
    p_performance_video_id,
    caller_id,
    p_owner_name,
    p_name,
    nullif(p_note, ''),
    'published'
  );

  insert into public.listening_preset_songs (
    preset_id,
    performance_video_id,
    song_index,
    title,
    clip_start,
    clip_end
  )
  select
    p_id,
    p_performance_video_id,
    item.song_index,
    item.title,
    item.clip_start,
    item.clip_end
  from jsonb_to_recordset(p_songs) as item(
    song_index integer,
    title text,
    clip_start numeric,
    clip_end numeric
  );
end;
$$;

create or replace function public.create_truth_request_with_songs(
  p_id uuid,
  p_performance_video_id text,
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

  insert into public.truth_requests (
    id,
    performance_video_id,
    requester_id,
    requester_name,
    note,
    status
  )
  values (
    p_id,
    p_performance_video_id,
    caller_id,
    p_requester_name,
    nullif(p_note, ''),
    'pending'
  );

  insert into public.truth_request_songs (
    request_id,
    performance_video_id,
    song_index,
    title,
    clip_start,
    clip_end
  )
  select
    p_id,
    p_performance_video_id,
    item.song_index,
    item.title,
    item.clip_start,
    item.clip_end
  from jsonb_to_recordset(p_songs) as item(
    song_index integer,
    title text,
    clip_start numeric,
    clip_end numeric
  );
end;
$$;

create or replace function public.apply_ground_truth_changes(
  p_performance_video_id text,
  p_draft jsonb,
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
    left join draft proposed on proposed.song_index = current.song_index
    where current.performance_video_id = p_performance_video_id
      and proposed.song_index is null

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
    performance_video_id,
    song_index,
    admin_id,
    request_id,
    change_type,
    previous_title,
    next_title,
    previous_clip_start,
    previous_clip_end,
    next_clip_start,
    next_clip_end,
    previous_confirmed,
    next_confirmed
  )
  select
    p_performance_video_id,
    changes.song_index,
    p_admin_id,
    p_request_id,
    changes.change_type,
    changes.previous_title,
    changes.next_title,
    changes.previous_clip_start,
    changes.previous_clip_end,
    changes.next_clip_start,
    changes.next_clip_end,
    changes.previous_confirmed,
    changes.next_confirmed
  from changes;

  get diagnostics applied_change_count = row_count;

  insert into public.songs (
    performance_video_id,
    song_index,
    title,
    clip_start,
    clip_end,
    confidence,
    suspect,
    updated_at
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
    and not exists (
      select 1
      from jsonb_to_recordset(p_draft) as proposed(
        song_index integer,
        title text,
        clip_start numeric,
        clip_end numeric,
        confirmed boolean
      )
      where proposed.song_index = current.song_index
    );

  select coalesce(bool_and(item.confirmed), true)
  into all_confirmed
  from jsonb_to_recordset(p_draft) as item(
    song_index integer,
    title text,
    clip_start numeric,
    clip_end numeric,
    confirmed boolean
  );

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

revoke execute on function public.save_review_with_rating(text, numeric, text, text) from public, anon;
grant execute on function public.save_review_with_rating(text, numeric, text, text) to authenticated;

revoke execute on function public.create_listening_preset_with_songs(uuid, text, text, text, text, jsonb) from public, anon;
grant execute on function public.create_listening_preset_with_songs(uuid, text, text, text, text, jsonb) to authenticated;

revoke execute on function public.create_truth_request_with_songs(uuid, text, text, text, jsonb) from public, anon;
grant execute on function public.create_truth_request_with_songs(uuid, text, text, text, jsonb) to authenticated;

revoke execute on function public.apply_ground_truth_changes(text, jsonb, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.apply_ground_truth_changes(text, jsonb, uuid, uuid, text) to service_role;
