import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { LikedSong, UserReview } from "@/lib/types";

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

export async function getUserLikedSongs(userId: string): Promise<LikedSong[]> {
  const supabase = await createClient();
  const { data: hearts, error: heartsError } = await supabase
    .from("song_hearts")
    .select("performance_video_id, song_index, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  throwIfError("Loading your liked songs", heartsError);

  if (!hearts || hearts.length === 0) return [];

  const videoIds = [...new Set(hearts.map((heart) => heart.performance_video_id))];
  const [songsResult, performancesResult] = await Promise.all([
    supabase
      .from("songs")
      .select("performance_video_id, song_index, title, clip_start, clip_end, heart_count")
      .in("performance_video_id", videoIds),
    supabase
      .from("performances")
      .select("video_id, artist, source_title, date")
      .in("video_id", videoIds),
  ]);
  throwIfError("Loading liked song details", songsResult.error);
  throwIfError("Loading liked song performances", performancesResult.error);

  const songsByKey = new Map(
    (songsResult.data ?? []).map((song) => [
      `${song.performance_video_id}:${song.song_index}`,
      song,
    ]),
  );
  const performancesById = new Map(
    (performancesResult.data ?? []).map((performance) => [performance.video_id, performance]),
  );

  return hearts.flatMap((heart) => {
    const song = songsByKey.get(`${heart.performance_video_id}:${heart.song_index}`);
    const performance = performancesById.get(heart.performance_video_id);
    if (!song || !performance) return [];
    return [{
      performanceVideoId: heart.performance_video_id,
      songIndex: heart.song_index,
      title: song.title,
      artist: performance.artist,
      performanceLabel: performance.source_title,
      performanceDate: performance.date,
      clipStart: Number(song.clip_start),
      clipEnd: Number(song.clip_end),
      heartCount: Number(song.heart_count ?? 0),
      heartedAt: heart.created_at,
    } satisfies LikedSong];
  });
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
