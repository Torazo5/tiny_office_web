create table if not exists public.feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  message text not null check (char_length(btrim(message)) between 1 and 5000),
  status text not null default 'new' check (status in ('new', 'reviewed')),
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_by_name text check (submitted_by_name is null or char_length(submitted_by_name) <= 80),
  source_path text check (source_path is null or char_length(source_path) <= 300),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists feedback_submissions_status_created_at_idx
  on public.feedback_submissions (status, created_at desc);
create index if not exists feedback_submissions_submitted_by_idx
  on public.feedback_submissions (submitted_by);

alter table public.feedback_submissions enable row level security;

-- Feedback is written by the server action with the server-only Supabase key.
-- Keep the table unreadable and unwritable through the public Data API.
revoke all on public.feedback_submissions from anon, authenticated;
grant all on public.feedback_submissions to service_role;

drop policy if exists "Feedback is not public" on public.feedback_submissions;
create policy "Feedback is not public"
  on public.feedback_submissions for all to anon, authenticated
  using (false)
  with check (false);
