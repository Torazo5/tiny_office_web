import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getPerformance, getPerformanceDetail } from "@/lib/data";
import { formatProfileLabel, getProfilesByUserId, type PublicProfile } from "@/lib/profile-data";
import type {
  PerformanceCutKey,
  PerformanceCutVariant,
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
  variant_key: PerformanceCutKey;
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

type PerformanceCutVariantRow = {
  variant_key: PerformanceCutKey;
  name: string;
  description: string;
};

type PerformanceCutVariantSongRow = {
  variant_key: PerformanceCutKey;
  performance_video_id: string;
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
    variantKey: preset.variant_key,
    ownerId: preset.owner_id,
    ownerName: formatProfileLabel(profiles.get(preset.owner_id)),
    name: preset.name,
    note: preset.note,
    status: preset.status,
    createdAt: preset.created_at,
    songs: songsByPreset.get(preset.id) ?? [],
  }));
}

async function loadPresets(
  client: Awaited<ReturnType<typeof createClient>>,
  videoId: string,
  variantKey?: PerformanceCutKey,
) {
  let query = client
    .from("listening_presets")
    .select("id, performance_video_id, variant_key, owner_id, name, note, status, created_at")
    .eq("performance_video_id", videoId)
    .order("created_at", { ascending: false });
  if (variantKey) query = query.eq("variant_key", variantKey);
  const { data: presetRows, error: presetError } = await query;
  throwIfError("Loading listening presets", presetError);

  const ids = (presetRows ?? []).map((preset) => preset.id);
  if (ids.length === 0) return [];

  const [profiles, { data: songRows, error: songError }] = await Promise.all([
    getProfilesByUserId((presetRows ?? []).map((preset) => preset.owner_id)),
    client
      .from("listening_preset_songs")
      .select("preset_id, song_index, title, clip_start, clip_end")
      .in("preset_id", ids)
      .order("song_index"),
  ]);
  throwIfError("Loading listening preset songs", songError);

  return mapPresets(presetRows as PresetRow[], (songRows ?? []) as PresetSongRow[], profiles);
}

async function loadPerformanceCutVariants(
  client: Awaited<ReturnType<typeof createClient>>,
  videoId: string,
) {
  const [variantsResult, songsResult] = await Promise.all([
    client
      .from("performance_cut_variants")
      .select("variant_key, name, description")
      .order("sort_order"),
    client
      .from("performance_cut_variant_songs")
      .select("variant_key, performance_video_id, song_index, title, clip_start, clip_end")
      .eq("performance_video_id", videoId)
      .order("variant_key")
      .order("song_index"),
  ]);
  throwIfError("Loading performance cut variants", variantsResult.error);
  throwIfError("Loading performance cut variant songs", songsResult.error);

  const songsByVariant = new Map<PerformanceCutKey, PerformanceCutVariant["songs"]>();
  for (const song of (songsResult.data ?? []) as PerformanceCutVariantSongRow[]) {
    const songs = songsByVariant.get(song.variant_key) ?? [];
    songs.push({
      songIndex: song.song_index,
      title: song.title,
      clipStart: Number(song.clip_start),
      clipEnd: Number(song.clip_end),
    });
    songsByVariant.set(song.variant_key, songs);
  }

  return ((variantsResult.data ?? []) as PerformanceCutVariantRow[])
    .filter((variant) => variant.variant_key === "no-audience" || songsByVariant.has(variant.variant_key))
    .map((variant) => ({
      key: variant.variant_key,
      name: variant.name,
      description: variant.description,
      songs: songsByVariant.get(variant.variant_key) ?? [],
    } satisfies PerformanceCutVariant));
}

export async function getListeningPresets(videoId: string, variantKey?: PerformanceCutKey) {
  const supabase = await createClient();
  return loadPresets(supabase, videoId, variantKey);
}

export async function getAdminListeningPresets() {
  const supabase = createAdminClient();
  const { data: presetRows, error: presetError } = await supabase
    .from("listening_presets")
    .select("id, performance_video_id, variant_key, owner_id, name, note, status, created_at")
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

export async function getSelectedPresetId(videoId: string, userId: string, variantKey: PerformanceCutKey) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("performance_preset_selections")
    .select("preset_id")
    .eq("performance_video_id", videoId)
    .eq("user_id", userId)
    .eq("variant_key", variantKey)
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

export function applyPerformanceCut(
  performance: Performance,
  variant: PerformanceCutVariant | null,
) {
  if (!variant || variant.key === "no-audience") {
    return performance;
  }
  return {
    ...performance,
    songs: variant.songs.map((edit) => {
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
  cutKey?: PerformanceCutKey,
) {
  const [performance, cutVariants] = await Promise.all([
    getPerformanceDetail(videoId, userId ?? null),
    loadPerformanceCutVariants(await createClient(), videoId),
  ]);
  if (!performance) return { performance, selectedPreset: null, selectedCut: null, cutVariants, presets: [] };
  const selectedCut = cutVariants.find((variant) => variant.key === (cutKey ?? "no-audience"))
    ?? cutVariants.find((variant) => variant.key === "no-audience")
    ?? null;
  const activeVariantKey = selectedCut?.key ?? "no-audience";
  const presets = await getListeningPresets(videoId, activeVariantKey);
  const performanceWithCut = applyPerformanceCut(performance, selectedCut);
  if (previewPresetId !== undefined) {
    const selectedPreset = previewPresetId === "ground-truth"
      ? null
      : presets.find((preset) => preset.id === previewPresetId) ?? null;
    return {
      performance: applyListeningPreset(performanceWithCut, selectedPreset),
      selectedPreset,
      selectedCut,
      cutVariants,
      presets,
    };
  }
  if (!userId) return { performance: performanceWithCut, selectedPreset: null, selectedCut, cutVariants, presets };

  const selectedPresetId = await getSelectedPresetId(videoId, userId, activeVariantKey);
  const selectedPreset = presets.find((preset) => preset.id === selectedPresetId) ?? null;
  return {
    performance: applyListeningPreset(performanceWithCut, selectedPreset),
    selectedPreset,
    selectedCut,
    cutVariants,
    presets,
  };
}

export async function getPerformanceForRevision(videoId: string, variantKey: PerformanceCutKey) {
  const [performance, cutVariants] = await Promise.all([
    getPerformance(videoId),
    loadPerformanceCutVariants(await createClient(), videoId),
  ]);
  const variant = cutVariants.find((candidate) => candidate.key === variantKey) ?? null;
  return {
    performance: performance ? applyPerformanceCut(performance, variant) : null,
    variant,
    cutVariants,
  };
}

type TruthRequestRow = {
  id: string;
  performance_video_id: string;
  variant_key: PerformanceCutKey;
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
    variantKey: row.variant_key,
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
    .select("id, performance_video_id, variant_key, requester_id, note, status, created_at, resolved_at, performances(artist)")
    .order("created_at", { ascending: false });
  throwIfError("Loading truth requests", error);
  const profiles = await getProfilesByUserId((data ?? []).map((row) => row.requester_id));
  return (data ?? []).map((row) => mapTruthRequest(row as TruthRequestRow, profiles));
}

export async function getMyTruthRequests(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("truth_requests")
    .select("id, performance_video_id, variant_key, requester_id, note, status, created_at, resolved_at, performances(artist)")
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
    .select("id, performance_video_id, variant_key, requester_id, note, status, created_at, resolved_at, performances(artist)")
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
    .select("id, performance_video_id, variant_key, requester_id, note, status, created_at, resolved_at, performances(artist)")
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

  const { performance } = await getPerformanceForRevision(request.performance_video_id, request.variant_key);
  if (!performance) throw new Error("Loading current boundary statuses: performance not found");
  const confirmedByIndex = new Map(performance.songs.map((song) => [song.index, !song.suspect]));

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
