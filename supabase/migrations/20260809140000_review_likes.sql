create table if not exists public.review_likes (
  review_id uuid not null references public.reviews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

create index if not exists review_likes_user_id_idx
  on public.review_likes(user_id);

alter table public.review_likes enable row level security;

drop policy if exists "Public review likes are readable" on public.review_likes;
create policy "Public review likes are readable"
  on public.review_likes for select to anon, authenticated
  using (true);

drop policy if exists "Users like reviews" on public.review_likes;
create policy "Users like reviews"
  on public.review_likes for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users remove their review likes" on public.review_likes;
create policy "Users remove their review likes"
  on public.review_likes for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.review_likes to anon, authenticated;
grant insert, delete on public.review_likes to authenticated;
