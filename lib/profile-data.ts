import "server-only";

import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import type { Performance } from "@/lib/types";

export const DEFAULT_PROFILE_DISPLAY_NAME = "Anonymous";

export type PublicProfile = {
  userId: string;
  displayName: string;
  tag: string;
  avatarUrl: string;
};

type ProfileRow = {
  user_id: string;
  display_name: string;
  tag: string;
};

function defaultTag(userId: string) {
  return `listener_${userId.replaceAll("-", "").slice(0, 8).toLowerCase()}`;
}

export function getIdenticonUrl(seed: string) {
  const privateSeed = createHash("sha256").update(seed).digest("hex");
  const params = new URLSearchParams({
    seed: privateSeed,
    backgroundColor: "252525",
    radius: "50",
  });
  return `https://api.dicebear.com/10.x/identicon/svg?${params.toString()}`;
}

function fallbackProfile(userId: string): PublicProfile {
  return {
    userId,
    displayName: DEFAULT_PROFILE_DISPLAY_NAME,
    tag: defaultTag(userId),
    avatarUrl: getIdenticonUrl(userId),
  };
}

export function formatProfileLabel(profile: PublicProfile | undefined) {
  if (!profile) return DEFAULT_PROFILE_DISPLAY_NAME;
  return `${profile.displayName} · @${profile.tag}`;
}

export async function getProfilesByUserId(userIds: readonly string[]) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  const profiles = new Map<string, PublicProfile>();
  if (uniqueUserIds.length === 0) return profiles;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, display_name, tag")
    .in("user_id", uniqueUserIds);
  if (error) throw new Error(`Loading public profiles: ${error.message}`);

  for (const userId of uniqueUserIds) {
    profiles.set(userId, fallbackProfile(userId));
  }
  for (const row of (data ?? []) as ProfileRow[]) {
    profiles.set(row.user_id, {
      userId: row.user_id,
      displayName: row.display_name,
      tag: row.tag,
      avatarUrl: getIdenticonUrl(row.user_id),
    });
  }
  return profiles;
}

export async function getUserProfile(userId: string) {
  return (await getProfilesByUserId([userId])).get(userId)!;
}

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
