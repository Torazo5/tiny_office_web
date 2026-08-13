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

export async function submitSongRequest(
  _previousState: SongRequestActionState,
  formData: FormData,
): Promise<SongRequestActionState> {
  if (readText(formData, "website", 200)) return { success: "Thanks — your request is saved." };

  const query = readText(formData, "query", 200);
  if (!query) return { error: "Tell us which concert or video you are looking for." };

  const note = readText(formData, "note", 1000);
  const sourcePath = readSourcePath(formData);
  const supabase = createAdminClient();

  const { error } = await supabase.from("song_requests").insert({
    query,
    note,
    source_path: sourcePath,
  });

  if (error) {
    console.error("[song-request/submit] Supabase insert failed", {
      code: error.code,
      message: error.message,
    });
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
