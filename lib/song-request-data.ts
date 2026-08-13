import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type SongRequestStatus = "pending" | "in_progress" | "imported" | "rejected";

export type AdminSongRequest = {
  id: string;
  query: string;
  note: string | null;
  sourcePath: string | null;
  status: SongRequestStatus;
  createdAt: string;
  resolvedAt: string | null;
};

type SongRequestRow = {
  id: string;
  query: string;
  note: string | null;
  source_path: string | null;
  status: SongRequestStatus;
  created_at: string;
  resolved_at: string | null;
};

export function mapSongRequest(row: SongRequestRow): AdminSongRequest {
  return {
    id: row.id,
    query: row.query,
    note: row.note,
    sourcePath: row.source_path,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

export async function getAdminSongRequests(): Promise<AdminSongRequest[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("song_requests")
    .select("id, query, note, source_path, status, created_at, resolved_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Loading song requests: ${error.message}`);
  return ((data ?? []) as SongRequestRow[]).map(mapSongRequest);
}
