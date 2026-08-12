"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { isAdminSession } from "@/lib/admin-session";
import { formatProfileLabel, getUserProfile } from "@/lib/profile-data";

export type FeedbackActionState = { error?: string; success?: string } | null;

function readText(formData: FormData, name: string, maxLength: number) {
  const value = formData.get(name);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : null;
}

export async function submitFeedback(formData: FormData): Promise<FeedbackActionState> {
  // A quiet honeypot keeps simple automated form spam out of the admin queue.
  if (readText(formData, "website", 200)) return { success: "Thanks for the feedback." };

  const message = readText(formData, "message", 5000);
  if (!message) return { error: "Write a little more so I know what to look into." };

  const sourcePathValue = readText(formData, "source_path", 300);
  const sourcePath = sourcePathValue?.startsWith("/") ? sourcePathValue : null;
  const user = await getCurrentUser();
  const submittedByName = user ? formatProfileLabel(await getUserProfile(user.id)) : null;

  const supabase = createAdminClient();
  const { error } = await supabase.from("feedback_submissions").insert({
    message,
    submitted_by: user?.id ?? null,
    submitted_by_name: submittedByName,
    source_path: sourcePath,
  });

  if (error) {
    console.error("[feedback/submitFeedback] Supabase insert failed", {
      code: error.code,
      message: error.message,
    });
    return { error: "Could not save your feedback. Please try again." };
  }

  revalidatePath("/review");
  return { success: "Thanks — your feedback is saved. I’ll check it from the admin dashboard." };
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !(await isAdminSession(user.id))) return null;
  return user;
}

export async function markFeedbackReviewed(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;

  const feedbackId = readText(formData, "feedback_id", 64);
  if (!feedbackId || !/^[0-9a-f-]{36}$/i.test(feedbackId)) return;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("feedback_submissions")
    .update({ status: "reviewed", reviewed_at: new Date().toISOString() })
    .eq("id", feedbackId)
    .eq("status", "new");

  if (error) {
    console.error("[feedback/markFeedbackReviewed] Supabase update failed", {
      code: error.code,
      message: error.message,
    });
    return;
  }

  revalidatePath("/review");
}
