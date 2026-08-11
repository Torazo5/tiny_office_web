import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { UserReview } from "@/lib/types";

function throwIfError(label: string, error: { message: string } | null) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

export async function getUserEngagement(videoId: string, userId?: string) {
  if (!userId) return { rating: null, review: null };

  const supabase = await createClient();
  const [ratingResult, reviewResult] = await Promise.all([
    supabase
      .from("ratings")
      .select("rating")
      .eq("performance_video_id", videoId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("reviews")
      .select("id, performance_video_id, rating, text, created_at, updated_at")
      .eq("performance_video_id", videoId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  throwIfError("Loading your rating", ratingResult.error);
  throwIfError("Loading your review", reviewResult.error);
  return {
    rating: ratingResult.data ? Number(ratingResult.data.rating) : null,
    review: reviewResult.data
      ? {
          id: reviewResult.data.id,
          rating: Number(reviewResult.data.rating),
          text: reviewResult.data.text,
        }
      : null,
  };
}

export async function getUserSongHeartKeys(userId?: string) {
  if (!userId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("song_hearts")
    .select("performance_video_id, song_index")
    .eq("user_id", userId);
  throwIfError("Loading your song hearts", error);
  return (data ?? []).map((heart) => `${heart.performance_video_id}:${heart.song_index}`);
}

export async function getUserReviews(userId: string): Promise<UserReview[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("id, performance_video_id, rating, text, created_at, updated_at, performances(artist, date)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  throwIfError("Loading your reviews", error);

  return (data ?? []).map((row) => {
    const performance = Array.isArray(row.performances) ? row.performances[0] : row.performances;
    return {
      id: row.id,
      performanceVideoId: row.performance_video_id,
      artist: performance?.artist ?? row.performance_video_id,
      performanceDate: performance?.date ?? null,
      rating: Number(row.rating),
      text: row.text,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
}
