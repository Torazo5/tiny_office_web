-- Keep the deny-by-default telemetry boundary explicit for security tooling.
drop policy if exists "No public product event access" on public.product_events;
create policy "No public product event access"
  on public.product_events
  for all to anon, authenticated
  using (false)
  with check (false);
