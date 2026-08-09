"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type FavoriteActionState = { error?: string; success?: string } | null;

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { supabase, user: null };
  return { supabase, user: data.user };
}

function isValidPosition(position: number) {
  return Number.isInteger(position) && position >= 1 && position <= 4;
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
