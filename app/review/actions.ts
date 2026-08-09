"use server";

import { randomUUID, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { endAdminSession, isAdminSession, startAdminSession } from "@/lib/admin-session";
import { getPerformance } from "@/lib/data";
import { formatProfileLabel, getUserProfile } from "@/lib/profile-data";
import { getAdminTruthRequest } from "@/lib/review-data";
import { draftChanged, validateTimelineDraft } from "@/lib/review-utils";
import type { TimelineDraftSong } from "@/lib/types";

export type ReviewActionState = { error?: string; success?: string } | null;

type GroundTruthSaveResult =
  | { error: string; allConfirmed?: never }
  | { error: null; allConfirmed: boolean };

type GroundTruthEdit = {
  performance_video_id: string;
  song_index: number;
  admin_id: string;
  request_id: string | null;
  change_type: "update" | "add" | "remove";
  previous_title: string | null;
  next_title: string | null;
  previous_clip_start: number | null;
  previous_clip_end: number | null;
  next_clip_start: number | null;
  next_clip_end: number | null;
  previous_confirmed: boolean | null;
  next_confirmed: boolean | null;
};

function readText(formData: FormData, name: string, maxLength: number) {
  const value = formData.get(name);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length <= maxLength ? trimmed : null;
}

function readDraft(formData: FormData): TimelineDraftSong[] | null {
  const raw = formData.get("draft");
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.map((item) => {
      if (!item || typeof item !== "object") throw new Error("invalid");
      const value = item as Record<string, unknown>;
      if (typeof value.confirmed !== "boolean") throw new Error("missing confirmation status");
      if (typeof value.title !== "string") throw new Error("missing song title");
      return {
        songIndex: Number(value.songIndex),
        title: value.title.trim(),
        clipStart: Number(value.clipStart),
        clipEnd: Number(value.clipEnd),
        confirmed: value.confirmed,
      };
    });
  } catch {
    return null;
  }
}

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { supabase, user: null };
  return { supabase, user: data.user };
}

async function requireAdmin() {
  const { user } = await getAuthenticatedUser();
  if (!user || !(await isAdminSession(user.id))) return null;
  return user;
}

async function loadGroundTruth(videoId: string) {
  const supabase = createAdminClient();
  const [{ data: performance, error: performanceError }, { data: songs, error: songsError }] = await Promise.all([
    supabase
      .from("performances")
      .select("video_id, duration")
      .eq("video_id", videoId)
      .maybeSingle(),
    supabase
      .from("songs")
      .select("id, performance_video_id, song_index, title, clip_start, clip_end, confidence, suspect")
      .eq("performance_video_id", videoId)
      .order("song_index"),
  ]);
  if (performanceError) throw new Error(`Loading performance: ${performanceError.message}`);
  if (songsError) throw new Error(`Loading songs: ${songsError.message}`);
  if (!performance) return null;
  return {
    supabase,
    duration: Number(performance.duration),
    songs: (songs ?? []).map((song) => ({
      id: song.id,
      performance_video_id: song.performance_video_id,
      song_index: Number(song.song_index),
      title: song.title,
      clip_start: Number(song.clip_start),
      clip_end: Number(song.clip_end),
      confidence: Number(song.confidence),
      suspect: Boolean(song.suspect),
    })),
  };
}

function validateSubmission(
  draft: TimelineDraftSong[] | null,
  performance: Awaited<ReturnType<typeof getPerformance>>,
) {
  if (!draft || !performance) return "This performance could not be loaded.";
  const error = validateTimelineDraft(draft, performance.songs, performance.duration);
  if (error) return error;
  if (!draftChanged(draft, performance.songs)) return "Change at least one song boundary before submitting.";
  return null;
}

export async function submitListeningPreset(
  _previousState: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const videoId = readText(formData, "performance_video_id", 32);
  const name = readText(formData, "preset_name", 80);
  const note = readText(formData, "note", 1000);
  if (!videoId || !name) return { error: "Give this listening preset a name up to 80 characters." };

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Sign in to publish a listening preset." };
  const performance = await getPerformance(videoId);
  const draft = readDraft(formData);
  const validationError = validateSubmission(draft, performance);
  if (validationError) return { error: validationError };

  const profile = await getUserProfile(user.id);

  const presetId = randomUUID();
  const { error: presetError } = await supabase.from("listening_presets").insert({
    id: presetId,
    performance_video_id: videoId,
    owner_id: user.id,
    owner_name: formatProfileLabel(profile),
    name,
    note: note || null,
    status: "published",
  });
  if (presetError) return { error: "Could not publish this listening preset. Try again." };

  const { error: songsError } = await supabase.from("listening_preset_songs").insert(
    draft!.map((song) => ({
      preset_id: presetId,
      performance_video_id: videoId,
      song_index: song.songIndex,
      title: song.title,
      clip_start: song.clipStart,
      clip_end: song.clipEnd,
    })),
  );
  if (songsError) {
    await supabase.from("listening_presets").delete().eq("id", presetId);
    return { error: "Could not save the preset timeline. Try again." };
  }

  revalidatePath(`/video/${videoId}`);
  revalidatePath(`/review/${videoId}`);
  return { success: `Published “${name}”.` };
}

export async function submitTruthRequest(
  _previousState: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const videoId = readText(formData, "performance_video_id", 32);
  const note = readText(formData, "note", 1000);
  if (!videoId) return { error: "Performance not found." };

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Sign in to submit a main-truth request." };
  const performance = await getPerformance(videoId);
  const draft = readDraft(formData);
  const validationError = validateSubmission(draft, performance);
  if (validationError) return { error: validationError };

  const profile = await getUserProfile(user.id);

  const requestId = randomUUID();
  const { error: requestError } = await supabase.from("truth_requests").insert({
    id: requestId,
    performance_video_id: videoId,
    requester_id: user.id,
    requester_name: formatProfileLabel(profile),
    note: note || null,
    status: "pending",
  });
  if (requestError) {
    if (requestError.code === "23505") return { error: "You already have a pending request for this performance." };
    return { error: "Could not submit the main-truth request. Try again." };
  }

  const { error: songsError } = await supabase.from("truth_request_songs").insert(
    draft!.map((song) => ({
      request_id: requestId,
      performance_video_id: videoId,
      song_index: song.songIndex,
      title: song.title,
      clip_start: song.clipStart,
      clip_end: song.clipEnd,
    })),
  );
  if (songsError) {
    await supabase.from("truth_requests").delete().eq("id", requestId);
    return { error: "Could not save the requested timeline. Try again." };
  }

  revalidatePath(`/review/${videoId}`);
  revalidatePath("/review");
  return { success: "Sent to the main-truth review queue." };
}

export async function selectListeningPreset(
  _previousState: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const videoId = readText(formData, "performance_video_id", 32);
  const presetId = readText(formData, "preset_id", 64);
  if (!videoId) return { error: "Performance not found." };

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Sign in to save your listening choice." };

  if (!presetId || presetId === "ground-truth") {
    const { error } = await supabase
      .from("performance_preset_selections")
      .delete()
      .eq("user_id", user.id)
      .eq("performance_video_id", videoId);
    if (error) return { error: "Could not restore main truth." };
    revalidatePath(`/video/${videoId}`);
    return { success: "Using main truth." };
  }

  const { data: preset, error: presetError } = await supabase
    .from("listening_presets")
    .select("id")
    .eq("id", presetId)
    .eq("performance_video_id", videoId)
    .eq("status", "published")
    .maybeSingle();
  if (presetError || !preset) return { error: "That listening preset is no longer available." };

  const { error } = await supabase.from("performance_preset_selections").upsert({
    user_id: user.id,
    performance_video_id: videoId,
    preset_id: preset.id,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: "Could not save that listening preset." };

  revalidatePath(`/video/${videoId}`);
  return { success: "Listening preset applied." };
}

export async function unlockAdmin(
  _previousState: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const { user } = await getAuthenticatedUser();
  if (!user) return { error: "Sign in before unlocking admin mode." };

  const password = formData.get("password");
  const expected = process.env.ADMIN_PASSWORD;
  if (typeof password !== "string" || !expected) return { error: "Admin access is not configured." };
  const actualBuffer = Buffer.from(password);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return { error: "That admin password is not correct." };
  }

  await startAdminSession(user.id);
  revalidatePath("/review");
  return { success: "Admin mode unlocked." };
}

export async function lockAdmin(_formData: FormData) {
  await endAdminSession();
  revalidatePath("/review");
  revalidatePath("/review/[id]", "page");
}

async function saveGroundTruth(
  videoId: string,
  draft: TimelineDraftSong[],
  adminId: string,
  requestId: string | null,
): Promise<GroundTruthSaveResult> {
  const groundTruth = await loadGroundTruth(videoId);
  if (!groundTruth) return { error: "Performance not found." };

  const songs = groundTruth.songs.map((song) => ({
    index: song.song_index,
    title: song.title,
    clipStart: song.clip_start,
    clipEnd: song.clip_end,
    confidence: song.confidence,
    suspect: song.suspect,
  }));
  const validationError = validateTimelineDraft(draft, songs, groundTruth.duration);
  if (validationError) return { error: validationError };

  const requested = new Map(draft.map((song) => [song.songIndex, song]));
  const edits: GroundTruthEdit[] = groundTruth.songs.flatMap((song): GroundTruthEdit[] => {
    const next = requested.get(song.song_index);
    const previousConfirmed = !song.suspect;
    if (!next) {
      return [{
        performance_video_id: videoId,
        song_index: song.song_index,
        admin_id: adminId,
        request_id: requestId,
        change_type: "remove",
        previous_title: song.title,
        next_title: null,
        previous_clip_start: song.clip_start,
        previous_clip_end: song.clip_end,
        next_clip_start: null,
        next_clip_end: null,
        previous_confirmed: previousConfirmed,
        next_confirmed: null,
      }];
    }
    if (
      next.title === song.title &&
      next.clipStart === song.clip_start &&
      next.clipEnd === song.clip_end &&
      next.confirmed === previousConfirmed
    ) return [];
    return [{
      performance_video_id: videoId,
      song_index: song.song_index,
      admin_id: adminId,
      request_id: requestId,
      change_type: "update",
      previous_title: song.title,
      next_title: next.title,
      previous_clip_start: song.clip_start,
      previous_clip_end: song.clip_end,
      next_clip_start: next.clipStart,
      next_clip_end: next.clipEnd,
      previous_confirmed: previousConfirmed,
      next_confirmed: next.confirmed,
    }];
  });

  for (const song of draft.filter((item) => !groundTruth.songs.some((candidate) => candidate.song_index === item.songIndex))) {
    edits.push({
      performance_video_id: videoId,
      song_index: song.songIndex,
      admin_id: adminId,
      request_id: requestId,
      change_type: "add",
      previous_title: null,
      next_title: song.title,
      previous_clip_start: null,
      previous_clip_end: null,
      next_clip_start: song.clipStart,
      next_clip_end: song.clipEnd,
      previous_confirmed: null,
      next_confirmed: song.confirmed,
    });
  }

  if (edits.length > 0) {
    const { error: auditError } = await groundTruth.supabase.from("ground_truth_edits").insert(edits);
    if (auditError) return { error: "Could not record the ground-truth audit." };
  }

  const now = new Date().toISOString();
  const nextSongs = draft.map((song) => {
    const previous = groundTruth.songs.find((candidate) => candidate.song_index === song.songIndex);
    return {
      id: previous?.id ?? randomUUID(),
      performance_video_id: videoId,
      song_index: song.songIndex,
      title: song.title,
      clip_start: song.clipStart,
      clip_end: song.clipEnd,
      confidence: previous?.confidence ?? 0,
      suspect: !song.confirmed,
      updated_at: now,
    };
  });
  if (nextSongs.length > 0) {
    const { error: songsError } = await groundTruth.supabase.from("songs").upsert(nextSongs, {
      onConflict: "performance_video_id,song_index",
    });
    if (songsError) return { error: "Could not update the official timeline." };
  }

  const removedIndexes = groundTruth.songs
    .map((song) => song.song_index)
    .filter((songIndex) => !requested.has(songIndex));
  if (removedIndexes.length > 0) {
    const { error: songsError } = await groundTruth.supabase
      .from("songs")
      .delete()
      .eq("performance_video_id", videoId)
      .in("song_index", removedIndexes);
    if (songsError) return { error: "The timeline was partly updated, but removed songs could not be deleted." };
  }

  const { error: performanceError } = await groundTruth.supabase
    .from("performances")
    .update({
      verified: draft.every((song) => song.confirmed),
      updated_at: new Date().toISOString(),
    })
    .eq("video_id", videoId);
  if (performanceError) return { error: "The timeline saved, but verification could not be updated." };

  return { error: null, allConfirmed: draft.every((song) => song.confirmed) };
}

function groundTruthSuccessMessage(allConfirmed: boolean) {
  return allConfirmed
    ? "Main truth updated and all boundaries confirmed."
    : "Main truth updated; the performance remains unverified because some boundaries are unconfirmed.";
}

export async function saveGroundTruthAction(
  _previousState: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const user = await requireAdmin();
  if (!user) return { error: "Admin access is required." };
  const videoId = readText(formData, "performance_video_id", 32);
  const draft = readDraft(formData);
  if (!videoId || !draft) return { error: "Invalid timeline submission." };

  const result = await saveGroundTruth(videoId, draft, user.id, null);
  if (result.error !== null) return result;
  revalidatePath("/");
  revalidatePath(`/video/${videoId}`);
  revalidatePath(`/review/${videoId}`);
  revalidatePath("/review");
  return { success: groundTruthSuccessMessage(result.allConfirmed) };
}

export async function resolveTruthRequest(
  _previousState: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const user = await requireAdmin();
  if (!user) return { error: "Admin access is required." };
  const requestId = readText(formData, "request_id", 64);
  const decision = readText(formData, "decision", 16);
  const resolutionNote = readText(formData, "resolution_note", 1000);
  if (!requestId || (decision !== "approve" && decision !== "reject")) {
    return { error: "Invalid request decision." };
  }

  const requestData = await getAdminTruthRequest(requestId);
  if (!requestData) return { error: "Truth request not found." };
  if (requestData.request.status !== "pending") return { error: "That request has already been resolved." };

  const supabase = createAdminClient();
  if (decision === "reject") {
    const { error } = await supabase
      .from("truth_requests")
      .update({
        status: "rejected",
        resolved_by: user.id,
        resolution_note: resolutionNote || null,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .eq("status", "pending");
    if (error) return { error: "Could not reject that request." };
    revalidatePath("/review");
    revalidatePath(`/review/${requestData.request.performanceVideoId}`);
    return { success: "Request rejected." };
  }

  const draft = readDraft(formData) ?? requestData.draft;
  const result = await saveGroundTruth(
    requestData.request.performanceVideoId,
    draft,
    user.id,
    requestId,
  );
  if (result.error !== null) return result;

  const { error } = await supabase
    .from("truth_requests")
    .update({
      status: "approved",
      resolved_by: user.id,
      resolution_note: resolutionNote || null,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("status", "pending");
  if (error) return { error: "Timeline saved, but the request status could not be updated." };

  revalidatePath("/");
  revalidatePath(`/video/${requestData.request.performanceVideoId}`);
  revalidatePath(`/review/${requestData.request.performanceVideoId}`);
  revalidatePath("/review");
  return { success: `Request approved and main truth updated. ${groundTruthSuccessMessage(result.allConfirmed)}` };
}

export async function hideListeningPreset(
  _previousState: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const user = await requireAdmin();
  if (!user) return { error: "Admin access is required." };
  const presetId = readText(formData, "preset_id", 64);
  if (!presetId) return { error: "Preset not found." };

  const supabase = createAdminClient();
  const { data: preset, error: presetError } = await supabase
    .from("listening_presets")
    .select("performance_video_id, status")
    .eq("id", presetId)
    .maybeSingle();
  if (presetError || !preset) return { error: "Preset not found." };
  const nextStatus = preset.status === "hidden" ? "published" : "hidden";
  const { error } = await supabase
    .from("listening_presets")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", presetId);
  if (error) return { error: "Could not update that preset." };
  revalidatePath(`/video/${preset.performance_video_id}`);
  revalidatePath("/review");
  return { success: nextStatus === "hidden" ? "Preset hidden." : "Preset published." };
}
