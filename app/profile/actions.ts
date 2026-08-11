"use server";

import { revalidatePath } from "next/cache";
import { normalizePlaybackSettings, type PlaybackSettings } from "@/lib/playback-settings";
import { createClient } from "@/lib/supabase/server";

export type FavoriteActionState = { error?: string; success?: string } | null;
export type ProfileActionState = { error?: string; success?: string } | null;
export type PlaybackDefaultsActionState = { error?: string } | { success: true };

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { supabase, user: null };
  return { supabase, user: data.user };
}

function isValidPosition(position: number) {
  return Number.isInteger(position) && position >= 1 && position <= 4;
}

function readDisplayName(formData: FormData) {
  const value = formData.get("display_name");
  if (typeof value !== "string") return null;
  const displayName = value.trim().replace(/\s+/g, " ");
  return displayName.length >= 1 && displayName.length <= 40 ? displayName : null;
}

function readTag(formData: FormData) {
  const value = formData.get("tag");
  if (typeof value !== "string") return null;
  const tag = value.trim().replace(/^@/, "").toLowerCase();
  return /^[a-z0-9_]{3,24}$/.test(tag) ? tag : null;
}

export async function updateProfile(
  _previousState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const displayName = readDisplayName(formData);
  const tag = readTag(formData);
  if (!displayName) return { error: "Choose a display name between 1 and 40 characters." };
  if (!tag) return { error: "Your tag must be 3–24 lowercase letters, numbers, or underscores." };

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Sign in to update your profile." };

  const { error } = await supabase.from("profiles").upsert(
    {
      user_id: user.id,
      display_name: displayName,
      tag,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) {
    if (error.code === "23505") return { error: "That tag is already taken. Try another one." };
    return { error: "Could not save your profile. Try again." };
  }

  revalidatePath("/profile");
  revalidatePath("/");
  return { success: "Profile saved." };
}

export async function savePlaybackDefaults(
  settings: PlaybackSettings,
): Promise<PlaybackDefaultsActionState> {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Sign in to save playback defaults." };

  const normalized = normalizePlaybackSettings(settings);
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profileError) return { error: "Could not save playback defaults. Try again." };

  const playbackDefaults = {
    playback_gap_seconds: normalized.gapSeconds,
    playback_fade_out_seconds: normalized.fadeOutSeconds,
    playback_fade_in_seconds: normalized.fadeInSeconds,
    playback_cut_audience: normalized.cutAudience,
    updated_at: new Date().toISOString(),
  };
  const { error } = profile
    ? await supabase.from("profiles").update(playbackDefaults).eq("user_id", user.id)
    : await supabase.from("profiles").insert({
      user_id: user.id,
      display_name: "Anonymous",
      tag: `listener_${user.id.replaceAll("-", "").slice(0, 8).toLowerCase()}`,
      ...playbackDefaults,
    });
  if (error) return { error: "Could not save playback defaults. Try again." };

  revalidatePath("/profile");
  revalidatePath("/playlist");
  revalidatePath("/random-pick");
  return { success: true };
}

export async function saveFavorite(
  position: number,
  performanceVideoId: string,
): Promise<FavoriteActionState> {
  if (!isValidPosition(position) || !performanceVideoId) return { error: "Choose a valid top-four slot." };

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Sign in to choose your favorites." };

  const { data: performance, error: performanceError } = await supabase
    .from("performances")
    .select("video_id")
    .eq("video_id", performanceVideoId)
    .maybeSingle();
  if (performanceError || !performance) return { error: "That performance could not be found." };

  const { data: current, error: currentError } = await supabase
    .from("profile_favorites")
    .select("position")
    .eq("user_id", user.id)
    .eq("performance_video_id", performanceVideoId)
    .maybeSingle();
  if (currentError) return { error: "Could not update your favorites." };

  if (current && Number(current.position) !== position) {
    const { error } = await supabase
      .from("profile_favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("position", current.position);
    if (error) return { error: "Could not move that favorite." };
  }

  const { error } = await supabase.from("profile_favorites").upsert(
    {
      user_id: user.id,
      position,
      performance_video_id: performance.video_id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,position" },
  );
  if (error) return { error: "Could not save that favorite." };

  revalidatePath("/profile");
  return { success: "Favorite saved." };
}

export async function removeFavorite(position: number): Promise<FavoriteActionState> {
  if (!isValidPosition(position)) return { error: "Choose a valid top-four slot." };

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Sign in to edit your favorites." };

  const { error } = await supabase
    .from("profile_favorites")
    .delete()
    .eq("user_id", user.id)
    .eq("position", position);
  if (error) return { error: "Could not remove that favorite." };

  revalidatePath("/profile");
  return { success: "Favorite removed." };
}
