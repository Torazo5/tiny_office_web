import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getPerformanceDetail } from "@/lib/data";
import { formatProfileLabel, getProfilesByUserId, type PublicProfile } from "@/lib/profile-data";
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
  name: string;
  note: string | null;
  status: "published" | "hidden";
  created_at: string;
};

type PresetSongRow = {
  preset_id: string;
  song_index: number;
  title: string;
  clip_start: number;
  clip_end: number;
};

function mapPresets(
  presetRows: PresetRow[],
  songRows: PresetSongRow[],
  profiles: Map<string, PublicProfile>,
): ListeningPreset[] {
  const songsByPreset = new Map<string, ListeningPreset["songs"]>();
  for (const song of songRows) {
    const songs = songsByPreset.get(song.preset_id) ?? [];
    songs.push({
      songIndex: song.song_index,
      title: song.title,
      clipStart: Number(song.clip_start),
      clipEnd: Number(song.clip_end),
    });
    songsByPreset.set(song.preset_id, songs);
  }

  return presetRows.map((preset) => ({
    id: preset.id,
    performanceVideoId: preset.performance_video_id,
    ownerId: preset.owner_id,
    ownerName: formatProfileLabel(profiles.get(preset.owner_id)),
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
    .select("id, performance_video_id, owner_id, name, note, status, created_at")
    .eq("performance_video_id", videoId)
    .order("created_at", { ascending: false });
  throwIfError("Loading listening presets", presetError);

  const ids = (presetRows ?? []).map((preset) => preset.id);
  if (ids.length === 0) return [];

  const profiles = await getProfilesByUserId((presetRows ?? []).map((preset) => preset.owner_id));

  const { data: songRows, error: songError } = await client
    .from("listening_preset_songs")
    .select("preset_id, song_index, title, clip_start, clip_end")
    .in("preset_id", ids)
    .order("song_index");
  throwIfError("Loading listening preset songs", songError);

  return mapPresets(presetRows as PresetRow[], (songRows ?? []) as PresetSongRow[], profiles);
}

export async function getListeningPresets(videoId: string) {
  const supabase = await createClient();
  return loadPresets(supabase, videoId);
}

export async function getAdminListeningPresets() {
  const supabase = createAdminClient();
  const { data: presetRows, error: presetError } = await supabase
    .from("listening_presets")
    .select("id, performance_video_id, owner_id, name, note, status, created_at")
    .order("created_at", { ascending: false });
  throwIfError("Loading admin listening presets", presetError);

  const ids = (presetRows ?? []).map((preset) => preset.id);
  if (ids.length === 0) return [];
  const profiles = await getProfilesByUserId((presetRows ?? []).map((preset) => preset.owner_id));
  const { data: songRows, error: songError } = await supabase
    .from("listening_preset_songs")
    .select("preset_id, song_index, title, clip_start, clip_end")
    .in("preset_id", ids)
    .order("song_index");
  throwIfError("Loading admin preset songs", songError);

  return mapPresets(presetRows as PresetRow[], (songRows ?? []) as PresetSongRow[], profiles);
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
  return {
    ...performance,
    songs: preset.songs.map((edit) => {
      const source = performance.songs.find((song) => song.index === edit.songIndex);
      return source
        ? { ...source, title: edit.title, clipStart: edit.clipStart, clipEnd: edit.clipEnd }
        : {
            index: edit.songIndex,
            title: edit.title,
            clipStart: edit.clipStart,
            clipEnd: edit.clipEnd,
            confidence: 0,
            suspect: false,
          };
    }),
  } satisfies Performance;
}

export async function getPerformanceWithSelectedPreset(
  videoId: string,
  userId?: string,
  previewPresetId?: string,
) {
  const [performance, presets] = await Promise.all([
    getPerformanceDetail(videoId, userId ?? null),
    getListeningPresets(videoId),
  ]);
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
  note: string | null;
  status: TruthRequestStatus;
  created_at: string;
  resolved_at: string | null;
  performances?: { artist: string } | { artist: string }[] | null;
};

function mapTruthRequest(
  row: TruthRequestRow,
  profiles: Map<string, PublicProfile>,
): TruthRequestSummary {
  const performance = Array.isArray(row.performances) ? row.performances[0] : row.performances;
  return {
    id: row.id,
    performanceVideoId: row.performance_video_id,
    artist: performance?.artist ?? row.performance_video_id,
    requesterId: row.requester_id,
    requesterName: formatProfileLabel(profiles.get(row.requester_id)),
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
    .select("id, performance_video_id, requester_id, note, status, created_at, resolved_at, performances(artist)")
    .order("created_at", { ascending: false });
  throwIfError("Loading truth requests", error);
  const profiles = await getProfilesByUserId((data ?? []).map((row) => row.requester_id));
  return (data ?? []).map((row) => mapTruthRequest(row as TruthRequestRow, profiles));
}

export async function getMyTruthRequests(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("truth_requests")
    .select("id, performance_video_id, requester_id, note, status, created_at, resolved_at, performances(artist)")
    .eq("requester_id", userId)
    .order("created_at", { ascending: false });
  throwIfError("Loading your truth requests", error);
  const profiles = await getProfilesByUserId((data ?? []).map((row) => row.requester_id));
  return (data ?? []).map((row) => mapTruthRequest(row as TruthRequestRow, profiles));
}

/**
 * The shared header only needs one dismissed-able notification, not the full
 * request history. Keep this query deliberately narrow and avoid a profile
 * lookup because the notification copy does not display the requester name.
 */
export async function getLatestResolvedTruthRequest(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("truth_requests")
    .select("id, performance_video_id, requester_id, note, status, created_at, resolved_at, performances(artist)")
    .eq("requester_id", userId)
    .neq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  throwIfError("Loading latest resolved truth request", error);
  return data ? mapTruthRequest(data as TruthRequestRow, new Map()) : null;
}

export async function getAdminTruthRequest(requestId: string) {
  const supabase = createAdminClient();
  const { data: request, error: requestError } = await supabase
    .from("truth_requests")
    .select("id, performance_video_id, requester_id, note, status, created_at, resolved_at, performances(artist)")
    .eq("id", requestId)
    .maybeSingle();
  throwIfError("Loading truth request", requestError);
  if (!request) return null;

  const profiles = await getProfilesByUserId([request.requester_id]);

  const { data: songRows, error: songsError } = await supabase
    .from("truth_request_songs")
    .select("song_index, title, clip_start, clip_end")
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
    request: mapTruthRequest(request as TruthRequestRow, profiles),
    draft: (songRows ?? []).map((song) => ({
      songIndex: song.song_index,
      title: song.title,
      clipStart: Number(song.clip_start),
      clipEnd: Number(song.clip_end),
      confirmed: confirmedByIndex.get(song.song_index) ?? false,
    })) as TimelineDraftSong[],
  };
}
