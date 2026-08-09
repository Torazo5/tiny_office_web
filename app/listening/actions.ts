"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function recordListeningProgress(
  performanceVideoId: string,
  seconds: number,
) {
  const rawSeconds = Number(seconds);
  if (!performanceVideoId || !Number.isFinite(rawSeconds) || rawSeconds <= 0) return;
  const increment = Math.min(30, rawSeconds);

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return;

  const { data: performance, error: performanceError } = await supabase
    .from("performances")
    .select("duration")
    .eq("video_id", performanceVideoId)
    .maybeSingle();
  if (performanceError || !performance) return;

  const { data: existing, error: existingError } = await supabase
    .from("listening_progress")
    .select("seconds_listened")
    .eq("user_id", authData.user.id)
    .eq("performance_video_id", performanceVideoId)
    .maybeSingle();
  if (existingError) return;

  const nextSeconds = Math.min(
    Math.max(0, Number(performance.duration)),
    Number(existing?.seconds_listened ?? 0) + increment,
  );
  const { error } = await supabase.from("listening_progress").upsert(
    {
      user_id: authData.user.id,
      performance_video_id: performanceVideoId,
      seconds_listened: nextSeconds,
      last_listened_at: new Date().toISOString(),
    },
    { onConflict: "user_id,performance_video_id" },
  );
  if (!error) revalidatePath("/profile");
}
