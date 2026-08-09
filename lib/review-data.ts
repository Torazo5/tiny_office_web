import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getPerformance } from "@/lib/data";
import type {
  ListeningPreset,
  Performance,
  TimelineDraftSong,
  TruthRequestSummary,
  TruthRequestStatus,
} from "@/lib/types";

function throwIfError(label: string, error: { message: string } | null) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

type PresetRow = {
  id: string;
  performance_video_id: string;
  owner_id: string;
  owner_name: string;
  name: string;
  note: string | null;
  status: "published" | "hidden";
  created_at: string;
};

type PresetSongRow = {
  preset_id: string;
  song_index: number;
  clip_start: number;
  clip_end: number;
};

function mapPresets(presetRows: PresetRow[], songRows: PresetSongRow[]): ListeningPreset[] {
  const songsByPreset = new Map<string, ListeningPreset["songs"]>();
  for (const song of songRows) {
    const songs = songsByPreset.get(song.preset_id) ?? [];
    songs.push({
      songIndex: song.song_index,
      clipStart: Number(song.clip_start),
      clipEnd: Number(song.clip_end),
    });
    songsByPreset.set(song.preset_id, songs);
  }

  return presetRows.map((preset) => ({
    id: preset.id,
    performanceVideoId: preset.performance_video_id,
    ownerId: preset.owner_id,
    ownerName: preset.owner_name,
    name: preset.name,
    note: preset.note,
    status: preset.status,
    createdAt: preset.created_at,
    songs: songsByPreset.get(preset.id) ?? [],
  }));
}

async function loadPresets(client: Awaited<ReturnType<typeof createClient>>, videoId: string) {
  const { data: presetRows, error: presetError } = await client
    .from("listening_presets")
    .select("id, performance_video_id, owner_id, owner_name, name, note, status, created_at")
    .eq("performance_video_id", videoId)
    .order("created_at", { ascending: false });
  throwIfError("Loading listening presets", presetError);

  const ids = (presetRows ?? []).map((preset) => preset.id);
  if (ids.length === 0) return [];

  const { data: songRows, error: songError } = await client
    .from("listening_preset_songs")
    .select("preset_id, song_index, clip_start, clip_end")
    .in("preset_id", ids)
    .order("song_index");
  throwIfError("Loading listening preset songs", songError);

  return mapPresets(presetRows as PresetRow[], (songRows ?? []) as PresetSongRow[]);
}

export async function getListeningPresets(videoId: string) {
  const supabase = await createClient();
  return loadPresets(supabase, videoId);
}

export async function getAdminListeningPresets() {
  const supabase = createAdminClient();
  const { data: presetRows, error: presetError } = await supabase
    .from("listening_presets")
    .select("id, performance_video_id, owner_id, owner_name, name, note, status, created_at")
    .order("created_at", { ascending: false });
  throwIfError("Loading admin listening presets", presetError);

  const ids = (presetRows ?? []).map((preset) => preset.id);
  if (ids.length === 0) return [];
  const { data: songRows, error: songError } = await supabase
    .from("listening_preset_songs")
    .select("preset_id, song_index, clip_start, clip_end")
    .in("preset_id", ids)
    .order("song_index");
  throwIfError("Loading admin preset songs", songError);

  return mapPresets(presetRows as PresetRow[], (songRows ?? []) as PresetSongRow[]);
}

export async function getSelectedPresetId(videoId: string, userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("performance_preset_selections")
    .select("preset_id")
    .eq("performance_video_id", videoId)
    .eq("user_id", userId)
    .maybeSingle();
  throwIfError("Loading selected listening preset", error);
  return data?.preset_id ?? null;
}

export function applyListeningPreset(performance: Performance, preset: ListeningPreset | null) {
  if (!preset || preset.performanceVideoId !== performance.videoId) return performance;
  const edits = new Map(preset.songs.map((song) => [song.songIndex, song]));
  return {
    ...performance,
    songs: performance.songs.map((song) => {
      const edit = edits.get(song.index);
      return edit
        ? { ...song, clipStart: edit.clipStart, clipEnd: edit.clipEnd }
        : song;
    }),
  } satisfies Performance;
}

export async function getPerformanceWithSelectedPreset(
  videoId: string,
  userId?: string,
  previewPresetId?: string,
) {
  const performance = await getPerformance(videoId);
  const presets = await getListeningPresets(videoId);
  if (!performance) return { performance, selectedPreset: null, presets };
  if (previewPresetId !== undefined) {
    const selectedPreset = previewPresetId === "ground-truth"
      ? null
      : presets.find((preset) => preset.id === previewPresetId) ?? null;
    return {
      performance: applyListeningPreset(performance, selectedPreset),
      selectedPreset,
      presets,
    };
  }
  if (!userId) return { performance, selectedPreset: null, presets };

  const selectedPresetId = await getSelectedPresetId(videoId, userId);
  const selectedPreset = presets.find((preset) => preset.id === selectedPresetId) ?? null;
  return {
    performance: applyListeningPreset(performance, selectedPreset),
    selectedPreset,
    presets,
  };
}

type TruthRequestRow = {
  id: string;
  performance_video_id: string;
  requester_id: string;
  requester_name: string;
  note: string | null;
  status: TruthRequestStatus;
  created_at: string;
  resolved_at: string | null;
  performances?: { artist: string } | { artist: string }[] | null;
};

function mapTruthRequest(row: TruthRequestRow): TruthRequestSummary {
  const performance = Array.isArray(row.performances) ? row.performances[0] : row.performances;
  return {
    id: row.id,
    performanceVideoId: row.performance_video_id,
    artist: performance?.artist ?? row.performance_video_id,
    requesterId: row.requester_id,
    requesterName: row.requester_name,
    note: row.note,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

export async function getAdminTruthRequests() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("truth_requests")
    .select("id, performance_video_id, requester_id, requester_name, note, status, created_at, resolved_at, performances(artist)")
    .order("created_at", { ascending: false });
  throwIfError("Loading truth requests", error);
  return (data ?? []).map((row) => mapTruthRequest(row as TruthRequestRow));
}

export async function getMyTruthRequests(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("truth_requests")
    .select("id, performance_video_id, requester_id, requester_name, note, status, created_at, resolved_at, performances(artist)")
    .eq("requester_id", userId)
    .order("created_at", { ascending: false });
  throwIfError("Loading your truth requests", error);
  return (data ?? []).map((row) => mapTruthRequest(row as TruthRequestRow));
}

export async function getAdminTruthRequest(requestId: string) {
  const supabase = createAdminClient();
  const { data: request, error: requestError } = await supabase
    .from("truth_requests")
    .select("id, performance_video_id, requester_id, requester_name, note, status, created_at, resolved_at, performances(artist)")
    .eq("id", requestId)
    .maybeSingle();
  throwIfError("Loading truth request", requestError);
  if (!request) return null;

  const { data: songRows, error: songsError } = await supabase
    .from("truth_request_songs")
    .select("song_index, clip_start, clip_end")
    .eq("request_id", requestId)
    .order("song_index");
  throwIfError("Loading truth request timeline", songsError);

  const { data: groundTruthSongs, error: groundTruthError } = await supabase
    .from("songs")
    .select("song_index, suspect")
    .eq("performance_video_id", request.performance_video_id);
  throwIfError("Loading current boundary statuses", groundTruthError);
  const confirmedByIndex = new Map(
    (groundTruthSongs ?? []).map((song) => [Number(song.song_index), !Boolean(song.suspect)]),
  );

  return {
    request: mapTruthRequest(request as TruthRequestRow),
    draft: (songRows ?? []).map((song) => ({
      songIndex: song.song_index,
      clipStart: Number(song.clip_start),
      clipEnd: Number(song.clip_end),
      confirmed: confirmedByIndex.get(song.song_index) ?? true,
    })) as TimelineDraftSong[],
  };
}
