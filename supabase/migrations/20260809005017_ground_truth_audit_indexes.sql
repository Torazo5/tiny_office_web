create index if not exists ground_truth_edits_admin_idx on public.ground_truth_edits (admin_id);
create index if not exists ground_truth_edits_performance_song_idx on public.ground_truth_edits (performance_video_id, song_index);
create index if not exists ground_truth_edits_request_idx on public.ground_truth_edits (request_id);
