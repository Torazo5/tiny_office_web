import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Performance } from "@/lib/types";

export type ProfileFavorite = {
  position: number;
  performanceVideoId: string | null;
  artist: string | null;
  date: string | null;
};

export async function getProfileStats(userId: string, performances: Performance[]) {
  const supabase = await createClient();
  const [favoritesResult, listeningResult] = await Promise.all([
    supabase
      .from("profile_favorites")
      .select("position, performance_video_id")
      .eq("user_id", userId)
      .order("position"),
    supabase
      .from("listening_progress")
      .select("performance_video_id, seconds_listened")
      .eq("user_id", userId),
  ]);

  if (favoritesResult.error) throw new Error(`Loading profile favorites: ${favoritesResult.error.message}`);
  if (listeningResult.error) throw new Error(`Loading listening progress: ${listeningResult.error.message}`);

  const performancesById = new Map(performances.map((performance) => [performance.videoId, performance]));
  const favoritesByPosition = new Map(
    (favoritesResult.data ?? []).map((favorite) => {
      const performance = performancesById.get(favorite.performance_video_id);
      return [Number(favorite.position), {
        position: Number(favorite.position),
        performanceVideoId: favorite.performance_video_id,
        artist: performance?.artist ?? null,
        date: performance?.date ?? null,
      } satisfies ProfileFavorite];
    }),
  );

  const favorites = Array.from({ length: 4 }, (_, index) => favoritesByPosition.get(index + 1) ?? {
    position: index + 1,
    performanceVideoId: null,
    artist: null,
    date: null,
  });
  const totalSecondsListened = (listeningResult.data ?? []).reduce(
    (total, row) => total + Math.max(0, Number(row.seconds_listened)),
    0,
  );

  return {
    favorites,
    listenedDeskCount: listeningResult.data?.length ?? 0,
    totalSecondsListened,
  };
}
