alter table public.ground_truth_edits
  add column if not exists previous_confirmed boolean not null default true,
  add column if not exists next_confirmed boolean not null default true;

comment on column public.ground_truth_edits.previous_confirmed is 'Whether the prior boundary was admin-confirmed.';
comment on column public.ground_truth_edits.next_confirmed is 'Whether the new boundary was admin-confirmed.';
