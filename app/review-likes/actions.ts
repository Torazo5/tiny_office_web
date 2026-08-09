"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ReviewLikeActionState = {
  error?: string;
  liked?: boolean;
  likeCount?: number;
} | null;

export async function toggleReviewLike(
  reviewId: string,
  shouldLike: boolean,
): Promise<ReviewLikeActionState> {
  if (!reviewId || reviewId.length > 64) return { error: "Review not found." };

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return { error: "Sign in to like reviews." };

  const { data: review, error: reviewError } = await supabase
    .from("reviews")
    .select("performance_video_id")
    .eq("id", reviewId)
    .maybeSingle();
  if (reviewError || !review) return { error: "Review not found." };

  if (shouldLike) {
    const { error } = await supabase.from("review_likes").insert({
      review_id: reviewId,
      user_id: authData.user.id,
    });
    if (error && error.code !== "23505") return { error: "Could not like this review." };
  } else {
    const { error } = await supabase
      .from("review_likes")
      .delete()
      .eq("review_id", reviewId)
      .eq("user_id", authData.user.id);
    if (error) return { error: "Could not remove your like." };
  }

  const { count, error: countError } = await supabase
    .from("review_likes")
    .select("review_id", { count: "exact", head: true })
    .eq("review_id", reviewId);
  if (countError) return { error: "Your like changed, but the count could not be refreshed." };

  revalidatePath(`/video/${review.performance_video_id}`);
  return { liked: shouldLike, likeCount: count ?? 0 };
}
