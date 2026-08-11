create table if not exists public.performance_cut_variants (
  variant_key text primary key check (variant_key in ('no-audience', 'with-audience')),
  name text not null,
  description text not null,
  is_default boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.performance_cut_variant_songs (
  variant_key text not null references public.performance_cut_variants(variant_key) on delete cascade,
  performance_video_id text not null references public.performances(video_id) on delete cascade,
  song_index integer not null check (song_index > 0),
  title text not null,
  clip_start numeric(10, 3) not null check (clip_start >= 0),
  clip_end numeric(10, 3) not null check (clip_end >= 0),
  confidence numeric(5, 2) not null default 0 check (confidence between 0 and 100),
  suspect boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (variant_key, performance_video_id, song_index)
);

create index if not exists performance_cut_variant_songs_video_idx
  on public.performance_cut_variant_songs(performance_video_id, variant_key, song_index);

alter table public.performance_cut_variants enable row level security;
alter table public.performance_cut_variant_songs enable row level security;

drop policy if exists "Public performance cut variants are readable" on public.performance_cut_variants;
create policy "Public performance cut variants are readable"
  on public.performance_cut_variants for select to anon, authenticated using (true);

drop policy if exists "Public performance cut variant songs are readable" on public.performance_cut_variant_songs;
create policy "Public performance cut variant songs are readable"
  on public.performance_cut_variant_songs for select to anon, authenticated using (true);

grant select on public.performance_cut_variants, public.performance_cut_variant_songs to anon, authenticated;
grant insert, update, delete on public.performance_cut_variants, public.performance_cut_variant_songs to service_role;

insert into public.performance_cut_variants (variant_key, name, description, is_default, sort_order)
values
  ('no-audience', 'No audience · tighter cut', 'Stops song clips before audience applause and room response.', true, 0),
  ('with-audience', 'With applause · less tight cut', 'Keeps more of the applause and room response around each song.', false, 1)
on conflict (variant_key) do update set
  name = excluded.name,
  description = excluded.description,
  is_default = excluded.is_default,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.performance_cut_variant_songs (
  variant_key,
  performance_video_id,
  song_index,
  title,
  clip_start,
  clip_end,
  confidence,
  suspect
)
select
  'with-audience',
  songs.performance_video_id,
  songs.song_index,
  songs.title,
  songs.clip_start,
  songs.clip_end,
  songs.confidence,
  songs.suspect
from public.songs
on conflict (variant_key, performance_video_id, song_index) do nothing;
