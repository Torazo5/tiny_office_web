"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { isAdminSession } from "@/lib/admin-session";
import type { SongRequestStatus } from "@/lib/song-request-data";

export type SongRequestActionState = { error?: string; success?: string } | null;

function readText(formData: FormData, name: string, maxLength: number) {
  const value = formData.get(name);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : null;
}

function readSourcePath(formData: FormData) {
  const value = readText(formData, "source_path", 300);
  return value?.startsWith("/") ? value : null;
}

function readYouTubeVideoId(formData: FormData) {
  const value = readText(formData, "youtube_video_id", 11);
  return value && /^[A-Za-z0-9_-]{11}$/.test(value) ? value : null;
}

function readYouTubePublishedAt(formData: FormData) {
  const value = readText(formData, "youtube_published_at", 40);
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function readYouTubeThumbnailUrl(formData: FormData) {
  const value = readText(formData, "youtube_thumbnail_url", 1000);
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "i.ytimg.com" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function submitSongRequest(
  _previousState: SongRequestActionState,
  formData: FormData,
): Promise<SongRequestActionState> {
  if (readText(formData, "website", 200)) return { success: "Thanks — your request is saved." };

  const query = readText(formData, "query", 200);
  if (!query) return { error: "Tell us which concert or video you are looking for." };

  const youtubeVideoId = readYouTubeVideoId(formData);
  const youtubeTitle = readText(formData, "youtube_title", 500);
  const youtubeChannelTitle = readText(formData, "youtube_channel_title", 200);
  const youtubeThumbnailUrl = readYouTubeThumbnailUrl(formData);
  const youtubePublishedAt = readYouTubePublishedAt(formData);
  const note = readText(formData, "note", 1000);
  const sourcePath = readSourcePath(formData);
  const supabase = createAdminClient();

  if (youtubeVideoId) {
    const { data: existingPerformance, error: performanceError } = await supabase
      .from("performances")
      .select("video_id")
      .eq("video_id", youtubeVideoId)
      .maybeSingle();
    if (performanceError) {
      console.error("[song-request/submit] Catalog lookup failed", {
        code: performanceError.code,
        message: performanceError.message,
      });
      return { error: "Could not check whether that video is already in Tiny Office." };
    }
    if (existingPerformance) return { error: "That video is already in Tiny Office." };
  }

  const { error } = await supabase.from("song_requests").insert({
    query,
    youtube_video_id: youtubeVideoId,
    youtube_title: youtubeTitle,
    youtube_channel_title: youtubeChannelTitle,
    youtube_thumbnail_url: youtubeThumbnailUrl,
    youtube_published_at: youtubePublishedAt,
    note,
    source_path: sourcePath,
  });

  if (error) {
    console.error("[song-request/submit] Supabase insert failed", {
      code: error.code,
      message: error.message,
    });
    if (error.code === "23505") return { error: "That video is already in the request queue." };
    return { error: "Could not save your request. Please try again." };
  }

  revalidatePath("/review");
  return { success: "Thanks — your request is in the import queue." };
}

function isSongRequestStatus(value: string | null): value is SongRequestStatus {
  return value === "pending" || value === "in_progress" || value === "imported" || value === "rejected";
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !(await isAdminSession(user.id))) return null;
  return user;
}

export async function updateSongRequestStatus(
  _previousState: SongRequestActionState,
  formData: FormData,
): Promise<SongRequestActionState> {
  const user = await requireAdmin();
  if (!user) return { error: "Admin access is required." };

  const requestId = readText(formData, "request_id", 64);
  const nextStatusValue = readText(formData, "status", 20);
  if (!requestId || !/^[0-9a-f-]{36}$/i.test(requestId) || !isSongRequestStatus(nextStatusValue)) {
    return { error: "Invalid song request update." };
  }

  const now = new Date().toISOString();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("song_requests")
    .update({
      status: nextStatusValue,
      resolved_by: nextStatusValue === "pending" || nextStatusValue === "in_progress" ? null : user.id,
      resolved_at: nextStatusValue === "pending" || nextStatusValue === "in_progress" ? null : now,
      updated_at: now,
    })
    .eq("id", requestId);

  if (error) {
    console.error("[song-request/updateStatus] Supabase update failed", {
      code: error.code,
      message: error.message,
    });
    return { error: "Could not update that request." };
  }

  revalidatePath("/review");
  return { success: "Request updated." };
}
