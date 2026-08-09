-- Public profile identity is intentionally separate from auth.users metadata.
-- Never use a provider's legal/full name as a public username.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Anonymous'
    check (char_length(trim(display_name)) between 1 and 40),
  tag text not null
    check (tag ~ '^[a-z0-9_]{3,24}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_tag_lower_unique_idx
  on public.profiles (lower(tag));

alter table public.profiles enable row level security;

drop policy if exists "Public profiles are readable" on public.profiles;
create policy "Public profiles are readable"
  on public.profiles for select to anon, authenticated
  using (true);

drop policy if exists "Users create their own profile" on public.profiles;
create policy "Users create their own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users update their own profile" on public.profiles;
create policy "Users update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;

-- Existing denormalized labels may contain provider metadata from the old
-- implementation. Replace them before the new profile UI is used. Runtime
-- reads resolve the current safe label from public.profiles instead.
update public.reviews set display_name = 'Anonymous';
update public.playlists set owner_name = 'Anonymous' where owner_id is not null;
update public.listening_presets set owner_name = 'Anonymous';
update public.truth_requests set requester_name = 'Anonymous';
