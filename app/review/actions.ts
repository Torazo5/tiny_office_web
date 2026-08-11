"use server";

import { randomUUID, timingSafeEqual } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { endAdminSession, isAdminSession, startAdminSession } from "@/lib/admin-session";
import { PUBLIC_CATALOG_CACHE_TAG } from "@/lib/data";
import { formatProfileLabel, getUserProfile } from "@/lib/profile-data";
import { getAdminTruthRequest, getPerformanceForRevision } from "@/lib/review-data";
import { draftChanged, validateTimelineDraft } from "@/lib/review-utils";
import type { Performance, PerformanceCutKey, TimelineDraftSong } from "@/lib/types";

export type ReviewActionState = { error?: string; success?: string } | null;

type GroundTruthSaveResult =
  | { error: string; allConfirmed?: never }
  | { error: null; allConfirmed: boolean; appliedChangeCount: number };

type DatabaseTimelineDraftSong = {
  song_index: number;
  title: string;
  clip_start: number;
  clip_end: number;
  confirmed: boolean;
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

function toDatabaseDraft(draft: TimelineDraftSong[]): DatabaseTimelineDraftSong[] {
  return draft.map((song) => ({
    song_index: song.songIndex,
    title: song.title,
    clip_start: song.clipStart,
    clip_end: song.clipEnd,
    confirmed: song.confirmed,
  }));
}

function readRemovedSongIndexes(formData: FormData): number[] | null {
  const raw = formData.get("removed_song_indexes");
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const indexes = parsed.map((value) => Number(value));
    if (indexes.some((index) => !Number.isInteger(index) || index <= 0)) return null;
    return [...new Set(indexes)];
  } catch {
    return null;
  }
}

function readVariantKey(formData: FormData): PerformanceCutKey | null {
  const value = readText(formData, "variant_key", 32);
  return value === "no-audience" || value === "with-audience" ? value : null;
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

function validateSubmission(
  draft: TimelineDraftSong[] | null,
  performance: Performance | null,
) {
  if (!draft || !performance) return "This performance could not be loaded.";
  const error = validateTimelineDraft(draft, performance.songs, performance.duration);
  if (error) return error;
  if (!draftChanged(draft, performance.songs)) return "Change at least one song boundary before submitting.";
  return null;
}

async function getVariantPerformance(videoId: string, variantKey: PerformanceCutKey) {
  const { performance, variant } = await getPerformanceForRevision(videoId, variantKey);
  if (!performance) return { error: "This performance could not be loaded.", performance: null };
  if (!variant) return { error: "That ground-truth timeline is not available for this performance.", performance: null };
  return { error: null, performance };
}

export async function submitListeningPreset(
  _previousState: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const videoId = readText(formData, "performance_video_id", 32);
  const variantKey = readVariantKey(formData);
  const name = readText(formData, "preset_name", 80);
  const note = readText(formData, "note", 1000);
  if (!videoId || !variantKey || !name) return { error: "Choose a ground-truth timeline and give this listening preset a name up to 80 characters." };

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Sign in to publish a listening preset." };
  const variantPerformance = await getVariantPerformance(videoId, variantKey);
  const draft = readDraft(formData);
  const validationError = variantPerformance.error ?? validateSubmission(draft, variantPerformance.performance);
  if (validationError || !draft) return { error: validationError ?? "This performance could not be loaded." };

  const profile = await getUserProfile(user.id);
  const databaseDraft = toDatabaseDraft(draft);

  const presetId = randomUUID();
  const { error } = await supabase.rpc("create_listening_preset_with_songs", {
    p_id: presetId,
    p_performance_video_id: videoId,
    p_variant_key: variantKey,
    p_owner_name: formatProfileLabel(profile),
    p_name: name,
    p_note: note || null,
    p_songs: databaseDraft,
  });
  if (error) {
    console.error("[review/submitListeningPreset] Supabase RPC failed", {
      code: error.code,
      message: error.message,
    });
    return { error: "Could not publish this listening preset. Try again." };
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
  const variantKey = readVariantKey(formData);
  const note = readText(formData, "note", 1000);
  if (!videoId || !variantKey) return { error: "Choose a ground-truth timeline before submitting." };

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Sign in to submit a main-truth request." };
  const variantPerformance = await getVariantPerformance(videoId, variantKey);
  const draft = readDraft(formData);
  const validationError = variantPerformance.error ?? validateSubmission(draft, variantPerformance.performance);
  if (validationError || !draft) return { error: validationError ?? "This performance could not be loaded." };

  const profile = await getUserProfile(user.id);
  const databaseDraft = toDatabaseDraft(draft);

  const requestId = randomUUID();
  const { error: requestError } = await supabase.rpc("create_truth_request_with_songs", {
    p_id: requestId,
    p_performance_video_id: videoId,
    p_variant_key: variantKey,
    p_requester_name: formatProfileLabel(profile),
    p_note: note || null,
    p_songs: databaseDraft,
  });
  if (requestError) {
    console.error("[review/submitTruthRequest] Supabase RPC failed", {
      code: requestError.code,
      message: requestError.message,
    });
    if (requestError.code === "23505") return { error: "You already have a pending request for this ground-truth timeline." };
    return { error: "Could not submit the main-truth request. Try again." };
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
  const variantKey = readVariantKey(formData);
  const presetId = readText(formData, "preset_id", 64);
  if (!videoId || !variantKey) return { error: "Ground-truth timeline not found." };

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Sign in to save your listening choice." };

  if (!presetId || presetId === "ground-truth") {
    const { error } = await supabase
      .from("performance_preset_selections")
      .delete()
      .eq("user_id", user.id)
      .eq("performance_video_id", videoId)
      .eq("variant_key", variantKey);
    if (error) return { error: "Could not restore main truth." };
    revalidatePath(`/video/${videoId}`);
    return { success: "Using main truth." };
  }

  const { data: preset, error: presetError } = await supabase
    .from("listening_presets")
    .select("id")
    .eq("id", presetId)
    .eq("performance_video_id", videoId)
    .eq("variant_key", variantKey)
    .eq("status", "published")
    .maybeSingle();
  if (presetError || !preset) return { error: "That listening preset is no longer available." };

  const { error } = await supabase.from("performance_preset_selections").upsert({
    user_id: user.id,
    performance_video_id: videoId,
    variant_key: variantKey,
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

export async function lockAdmin() {
  await endAdminSession();
  revalidatePath("/review");
  revalidatePath("/review/[id]", "page");
}

async function saveGroundTruth(
  videoId: string,
  variantKey: PerformanceCutKey,
  draft: TimelineDraftSong[],
  removedSongIndexes: number[],
  adminId: string,
  requestId: string | null,
  resolutionNote: string | null = null,
): Promise<GroundTruthSaveResult> {
  const variantPerformance = await getVariantPerformance(videoId, variantKey);
  if (variantPerformance.error || !variantPerformance.performance) return { error: variantPerformance.error ?? "Performance not found." };

  const validationError = validateTimelineDraft(draft, variantPerformance.performance.songs, variantPerformance.performance.duration);
  if (validationError) return { error: validationError };

  const supabase = createAdminClient();
  const databaseDraft = toDatabaseDraft(draft);
  const { data, error } = await supabase.rpc("apply_ground_truth_changes", {
    p_performance_video_id: videoId,
    p_variant_key: variantKey,
    p_draft: databaseDraft,
    p_removed_song_indexes: removedSongIndexes,
    p_admin_id: adminId,
    p_request_id: requestId,
    p_resolution_note: resolutionNote,
  });
  if (error) {
    console.error("[review/saveGroundTruth] Supabase RPC failed", {
      code: error.code,
      message: error.message,
    });
    return { error: "Could not update the official timeline." };
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (!result) return { error: "The timeline update returned no result." };

  revalidateTag(PUBLIC_CATALOG_CACHE_TAG, "max");

  return {
    error: null,
    allConfirmed: Boolean(result.all_confirmed),
    appliedChangeCount: Number(result.applied_change_count),
  };
}

function groundTruthSuccessMessage(allConfirmed: boolean, appliedChangeCount: number) {
  const prefix = appliedChangeCount === 0 ? "No main-truth changes applied." : "Main truth updated.";
  return allConfirmed
    ? `${prefix} All boundaries confirmed.`
    : `${prefix} The performance remains unverified because some boundaries are unconfirmed.`;
}

export async function saveGroundTruthAction(
  _previousState: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const user = await requireAdmin();
  if (!user) return { error: "Admin access is required." };
  const videoId = readText(formData, "performance_video_id", 32);
  const variantKey = readVariantKey(formData);
  const draft = readDraft(formData);
  const removedSongIndexes = readRemovedSongIndexes(formData);
  if (!videoId || !variantKey || !draft || !removedSongIndexes) return { error: "Invalid timeline submission." };

  const result = await saveGroundTruth(videoId, variantKey, draft, removedSongIndexes, user.id, null);
  if (result.error !== null) return result;
  revalidatePath("/");
  revalidatePath(`/video/${videoId}`);
  revalidatePath(`/review/${videoId}`);
  revalidatePath("/review");
  return { success: groundTruthSuccessMessage(result.allConfirmed, result.appliedChangeCount) };
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
  const removedSongIndexes = readRemovedSongIndexes(formData);
  if (!removedSongIndexes) return { error: "Invalid removal decision." };
  const result = await saveGroundTruth(
    requestData.request.performanceVideoId,
    requestData.request.variantKey,
    draft,
    removedSongIndexes,
    user.id,
    requestId,
    resolutionNote,
  );
  if (result.error !== null) return result;

  revalidatePath("/");
  revalidatePath(`/video/${requestData.request.performanceVideoId}`);
  revalidatePath(`/review/${requestData.request.performanceVideoId}`);
  revalidatePath("/review");
  return { success: `Request resolved with selected changes. ${groundTruthSuccessMessage(result.allConfirmed, result.appliedChangeCount)}` };
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
