import Link from "next/link";
import { AdminUnlockForm } from "@/components/admin-unlock-form";
import { PresetModerationForm } from "@/components/preset-moderation-form";
import { Header } from "@/components/header";
import { getCurrentUser } from "@/lib/auth";
import { isAdminSession } from "@/lib/admin-session";
import { getAdminListeningPresets, getAdminTruthRequests } from "@/lib/review-data";
import { getReviewQueue } from "@/lib/data";
import { lockAdmin } from "@/app/review/actions";
import { getAdminFeedbackSubmissions } from "@/lib/feedback-data";
import { markFeedbackReviewed } from "@/app/feedback/actions";
import { SongRequestModerationForm } from "@/components/song-request-moderation-form";
import { getAdminSongRequests } from "@/lib/song-request-data";

function formatFeedbackDate(value: string) {
  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function ReviewQueuePage() {
  const user = await getCurrentUser();
  const isAdmin = Boolean(user && (await isAdminSession(user.id)));

  if (!user || !isAdmin) {
    return (
      <>
        <Header user={user} />
        <main className="mx-auto w-full max-w-[720px] p-4 sm:p-8">
          <h1 className="text-xl font-semibold text-foreground">Review dashboard</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            This area is for signed-in admins reviewing main-truth requests and community presets.
          </p>
          {!user ? (
            <Link href="/login?next=/review" className="mt-5 inline-block rounded-lg bg-primary px-3.5 py-2 text-[13px] font-semibold text-primary-foreground">
              Sign in to continue
            </Link>
          ) : (
            <AdminUnlockForm />
          )}
        </main>
      </>
    );
  }

  const [queue, requests, presets, feedback, songRequests] = await Promise.all([
    getReviewQueue(),
    getAdminTruthRequests(),
    getAdminListeningPresets(),
    getAdminFeedbackSubmissions(),
    getAdminSongRequests(),
  ]);
  const pendingRequests = requests.filter((request) => request.status === "pending");
  const newFeedbackCount = feedback.filter((item) => item.status === "new").length;
  const pendingSongRequestCount = songRequests.filter((request) => request.status === "pending" || request.status === "in_progress").length;

  return (
    <>
      <Header progressLabel="Admin dashboard" user={user} />
      <main className="p-4 sm:p-8">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Review dashboard</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {pendingRequests.length} pending main-truth request{pendingRequests.length === 1 ? "" : "s"} · {pendingSongRequestCount} song request{pendingSongRequestCount === 1 ? "" : "s"} · {presets.length} listening presets · {newFeedbackCount} new feedback
            </p>
          </div>
          <form action={lockAdmin}>
            <button type="submit" className="rounded-lg border border-input px-3.5 py-2 text-[12.5px] font-medium text-muted-foreground hover:text-foreground">Lock admin mode</button>
          </form>
        </div>

        <section className="mb-8">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Song requests</h2>
            <span className="text-[12px] text-muted-foreground">{pendingSongRequestCount} active · {songRequests.length} total</span>
          </div>
          <div className="overflow-hidden rounded-lg border border-border">
            {songRequests.length === 0 && <p className="px-4 py-4 text-[13px] text-muted-foreground">No song requests yet.</p>}
            {songRequests.map((request) => (
              <article key={request.id} className="border-t border-border px-4 py-4 first:border-t-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="whitespace-pre-wrap break-words text-[13.5px] font-medium leading-relaxed text-foreground">{request.query}</p>
                    <p className="mt-1 text-[12px] text-muted-foreground">{formatFeedbackDate(request.createdAt)}{request.sourcePath ? ` · ${request.sourcePath}` : ""}</p>
                    {request.note && <p className="mt-2 whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-muted-foreground">{request.note}</p>}
                  </div>
                  <SongRequestModerationForm requestId={request.id} status={request.status} />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Feedback</h2>
            <span className="text-[12px] text-muted-foreground">{newFeedbackCount} new · {feedback.length} total</span>
          </div>
          <div className="overflow-hidden rounded-lg border border-border">
            {feedback.length === 0 && <p className="px-4 py-4 text-[13px] text-muted-foreground">No feedback yet.</p>}
            {feedback.map((item) => (
              <article key={item.id} className="border-t border-border px-4 py-4 first:border-t-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-foreground">{item.message}</p>
                    <p className="mt-2 text-[11.5px] text-muted-foreground">
                      {item.submittedByName ?? "Anonymous visitor"} · {formatFeedbackDate(item.createdAt)}{item.sourcePath ? ` · ${item.sourcePath}` : ""}
                    </p>
                  </div>
                  {item.status === "new" ? (
                    <form action={markFeedbackReviewed} className="shrink-0">
                      <input type="hidden" name="feedback_id" value={item.id} />
                      <button type="submit" className="rounded-lg border border-input px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:border-success/50 hover:text-success">
                        Mark reviewed
                      </button>
                    </form>
                  ) : (
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-success">Reviewed</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Main-truth requests</h2>
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="hidden bg-card px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:grid md:grid-cols-[2fr_1fr_1.1fr_1.1fr_0.8fr]">
              <div>Performance</div>
              <div>Submitted by</div>
              <div>Ground truth</div>
              <div>Status</div>
              <div />
            </div>
            {requests.length === 0 && <p className="border-t border-border px-4 py-4 text-[13px] text-muted-foreground">No main-truth requests yet.</p>}
            {requests.map((request) => (
              <Link
                key={request.id}
                href={`/review/${request.performanceVideoId}?admin=1&request=${request.id}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-t border-border px-4 py-3.5 hover:bg-secondary/50 md:grid-cols-[2fr_1fr_1.1fr_1.1fr_0.8fr]"
              >
                <div className="text-[13.5px] font-medium text-foreground">{request.artist}</div>
                <div className="text-[12.5px] text-muted-foreground">{request.requesterName}</div>
                <div className="text-[12.5px] text-muted-foreground">{request.variantKey === "no-audience" ? "No audience" : "With applause"}</div>
                <div className={`font-mono text-[11px] uppercase tracking-wide ${request.status === "approved" ? "text-success" : request.status === "rejected" ? "text-primary" : "text-muted-foreground"}`}>{request.status}</div>
                <div className="text-right text-[12.5px] font-medium text-primary">Open →</div>
              </Link>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Pipeline review queue</h2>
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="hidden bg-card px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:grid md:grid-cols-[2.2fr_0.9fr_2.3fr_0.8fr]">
              <div>Performance</div>
              <div>Confidence</div>
              <div>Why</div>
              <div />
            </div>
            {queue.length === 0 && <p className="border-t border-border px-4 py-4 text-[13px] text-muted-foreground">No performances need confirmation.</p>}
            {queue.map((item) => (
              <Link
                key={item.videoId}
                href={`/review/${item.videoId}?admin=1&cut=no-audience`}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-t border-border px-4 py-3.5 hover:bg-secondary/50 md:grid-cols-[2.2fr_0.9fr_2.3fr_0.8fr]"
              >
                <div className="text-[13.5px] font-medium text-foreground">{item.artist}</div>
                <div className={`font-mono text-[13px] font-semibold ${item.confidencePct < 70 ? "text-primary" : "text-muted-foreground"}`}>{item.confidencePct}%</div>
                <div className="col-span-2 text-[12.5px] text-muted-foreground md:col-span-1">{item.whyText}</div>
                <div className="text-right text-[12.5px] font-medium text-primary">Review →</div>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Listening presets</h2>
          <div className="overflow-hidden rounded-lg border border-border">
            {presets.length === 0 && <p className="px-4 py-4 text-[13px] text-muted-foreground">No presets yet.</p>}
            {presets.map((preset) => (
              <div key={preset.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3.5 first:border-t-0">
                <div>
                  <div className="text-[13.5px] font-medium text-foreground">{preset.name}</div>
                  <div className="text-[12px] text-muted-foreground">{preset.ownerName} · {preset.performanceVideoId} · {preset.variantKey === "no-audience" ? "No audience" : "With applause"} · {preset.status}</div>
                </div>
                <PresetModerationForm presetId={preset.id} status={preset.status} />
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
