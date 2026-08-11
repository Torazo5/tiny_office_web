"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SongHeartActionState = { error?: string; hearted?: boolean } | null;

export async function toggleSongHeart(
  performanceVideoId: string,
  songIndex: number,
  shouldHeart: boolean,
): Promise<SongHeartActionState> {
  if (!performanceVideoId || performanceVideoId.length > 64 || !Number.isInteger(songIndex) || songIndex < 1) {
    return { error: "Song not found." };
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return { error: "Sign in to heart songs." };

  const { data: song, error: songError } = await supabase
    .from("songs")
    .select("song_index")
    .eq("performance_video_id", performanceVideoId)
    .eq("song_index", songIndex)
    .maybeSingle();
  if (songError || !song) return { error: "Song not found." };

  if (shouldHeart) {
    const { error } = await supabase.from("song_hearts").insert({
      performance_video_id: performanceVideoId,
      song_index: songIndex,
      user_id: authData.user.id,
    });
    if (error && error.code !== "23505") return { error: "Could not heart this song." };
  } else {
    const { error } = await supabase
      .from("song_hearts")
      .delete()
      .eq("performance_video_id", performanceVideoId)
      .eq("song_index", songIndex)
      .eq("user_id", authData.user.id);
    if (error) return { error: "Could not remove this heart." };
  }

  revalidatePath(`/video/${performanceVideoId}`);
  revalidatePath("/random-pick");
  revalidatePath("/adventure");
  return { hearted: shouldHeart };
}
