import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type FeedbackStatus = "new" | "reviewed";

export type FeedbackSubmission = {
  id: string;
  message: string;
  status: FeedbackStatus;
  submittedByName: string | null;
  sourcePath: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

type FeedbackSubmissionRow = {
  id: string;
  message: string;
  status: FeedbackStatus;
  submitted_by_name: string | null;
  source_path: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export async function getAdminFeedbackSubmissions(): Promise<FeedbackSubmission[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("feedback_submissions")
    .select("id, message, status, submitted_by_name, source_path, created_at, reviewed_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Loading feedback submissions: ${error.message}`);

  return ((data ?? []) as FeedbackSubmissionRow[]).map((row) => ({
    id: row.id,
    message: row.message,
    status: row.status,
    submittedByName: row.submitted_by_name,
    sourcePath: row.source_path,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  }));
}
