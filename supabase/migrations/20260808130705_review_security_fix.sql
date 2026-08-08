drop policy if exists "Ground truth audits are private" on public.ground_truth_edits;
create policy "Ground truth audits are private"
  on public.ground_truth_edits for select to anon, authenticated
  using (false);

revoke all on public.listening_presets, public.listening_preset_songs,
  public.performance_preset_selections, public.truth_requests,
  public.truth_request_songs, public.ground_truth_edits from anon, authenticated;
grant select on public.listening_presets, public.listening_preset_songs to anon, authenticated;
grant insert, update, delete on public.listening_presets, public.listening_preset_songs to authenticated;
grant select, insert, update, delete on public.performance_preset_selections to authenticated;
grant select, insert on public.truth_requests, public.truth_request_songs to authenticated;

drop policy if exists "Users delete their pending truth requests" on public.truth_requests;
create policy "Users delete their pending truth requests"
  on public.truth_requests for delete to authenticated
  using ((select auth.uid()) = requester_id and status = 'pending');
