drop policy if exists "Users delete their pending truth requests" on public.truth_requests;
create policy "Users delete their pending truth requests"
  on public.truth_requests for delete to authenticated
  using ((select auth.uid()) = requester_id and status = 'pending');

grant delete on public.truth_requests to authenticated;
