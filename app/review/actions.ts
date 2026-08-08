"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const actions = new Set(["nudge_start", "nudge_end", "confirm", "skip", "mark_bad"]);

export async function recordReviewAction(formData: FormData) {
  const performanceVideoId = String(formData.get("performance_video_id") ?? "");
  const songIndex = Number(formData.get("song_index"));
  const action = String(formData.get("action") ?? "");
  const clipStart = Number(formData.get("clip_start"));
  const clipEnd = Number(formData.get("clip_end"));

  if (
    !performanceVideoId ||
    !Number.isInteger(songIndex) ||
    !actions.has(action) ||
    !Number.isFinite(clipStart) ||
    !Number.isFinite(clipEnd)
  ) {
    throw new Error("Invalid review action.");
  }

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("Sign in to review song boundaries.");

  const { data: song, error: songError } = await supabase
    .from("songs")
    .select("performance_video_id, song_index")
    .eq("performance_video_id", performanceVideoId)
    .eq("song_index", songIndex)
    .maybeSingle();
  if (songError) throw new Error(`Checking song: ${songError.message}`);
  if (!song) throw new Error("Song not found.");

  const nextStart = action === "nudge_start" ? Math.max(0, clipStart + 5) : clipStart;
  const nextEnd = action === "nudge_end" ? Math.max(nextStart, clipEnd + 5) : clipEnd;
  const { error } = await supabase.from("song_corrections").insert({
    performance_video_id: song.performance_video_id,
    song_index: song.song_index,
    user_id: userData.user.id,
    action,
    clip_start: nextStart,
    clip_end: nextEnd,
  });
  if (error) throw new Error(`Saving review action: ${error.message}`);

  revalidatePath("/");
  revalidatePath(`/review/${performanceVideoId}`);
  revalidatePath(`/video/${performanceVideoId}`);
  revalidatePath("/review");
}
