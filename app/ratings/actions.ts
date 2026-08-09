"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { formatProfileLabel, getUserProfile } from "@/lib/profile-data";

export type EngagementActionState = { error?: string; success?: string } | null;

function isValidRating(rating: number) {
  return Number.isFinite(rating) && rating >= 0.5 && rating <= 5 && Number.isInteger(rating * 2);
}

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { supabase, user: null };
  return { supabase, user: data.user };
}

async function performanceExists(
  supabase: Awaited<ReturnType<typeof createClient>>,
  videoId: string,
) {
  const { data, error } = await supabase
    .from("performances")
    .select("video_id")
    .eq("video_id", videoId)
    .maybeSingle();
  return !error && Boolean(data);
}

export async function saveRating(
  performanceVideoId: string,
  rating: number,
): Promise<EngagementActionState> {
  if (!performanceVideoId || !isValidRating(rating)) {
    return { error: "Choose a rating from 0.5 to 5 stars." };
  }

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Sign in to rate performances." };
  if (!(await performanceExists(supabase, performanceVideoId))) {
    return { error: "Performance not found." };
  }

  const { error } = await supabase.from("ratings").upsert(
    {
      performance_video_id: performanceVideoId,
      user_id: user.id,
      rating,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "performance_video_id,user_id" },
  );
  if (error) return { error: "Could not save your rating. Try again." };

  revalidatePath(`/video/${performanceVideoId}`);
  revalidatePath("/");
  revalidatePath("/profile");
  return { success: "Rating saved." };
}

export async function saveReview(input: {
  performanceVideoId: string;
  rating: number;
  text: string;
}): Promise<EngagementActionState> {
  const text = input.text.trim();
  if (!input.performanceVideoId || !isValidRating(input.rating)) {
    return { error: "Choose a rating from 0.5 to 5 stars before writing a review." };
  }
  if (!text || text.length > 5000) {
    return { error: "Write a review between 1 and 5,000 characters." };
  }

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Sign in to write reviews." };
  if (!(await performanceExists(supabase, input.performanceVideoId))) {
    return { error: "Performance not found." };
  }

  const profile = await getUserProfile(user.id);

  const { error } = await supabase.rpc("save_review_with_rating", {
    p_performance_video_id: input.performanceVideoId,
    p_rating: input.rating,
    p_text: text,
    p_display_name: formatProfileLabel(profile),
  });
  if (error) return { error: "Could not save your review. Try again." };

  revalidatePath(`/video/${input.performanceVideoId}`);
  revalidatePath("/");
  revalidatePath("/profile");
  return { success: "Review saved." };
}
