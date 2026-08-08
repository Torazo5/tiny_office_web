import Link from "next/link";
import { AdminUnlockForm } from "@/components/admin-unlock-form";
import { PresetModerationForm } from "@/components/preset-moderation-form";
import { Header } from "@/components/header";
import { getCurrentUser } from "@/lib/auth";
import { isAdminSession } from "@/lib/admin-session";
import { getAdminListeningPresets, getAdminTruthRequests } from "@/lib/review-data";
import { getReviewQueue } from "@/lib/data";
import { lockAdmin } from "@/app/review/actions";

export default async function ReviewQueuePage() {
  const user = await getCurrentUser();
  const isAdmin = Boolean(user && (await isAdminSession(user.id)));

  if (!user || !isAdmin) {
    return (
      <>
        <Header />
        <main className="mx-auto w-full max-w-[720px] p-8">
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

  const [queue, requests, presets] = await Promise.all([
    getReviewQueue(),
    getAdminTruthRequests(),
    getAdminListeningPresets(),
  ]);
  const pendingRequests = requests.filter((request) => request.status === "pending");

  return (
    <>
      <Header progressLabel="Admin dashboard" />
      <main className="p-8">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Review dashboard</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {pendingRequests.length} pending main-truth request{pendingRequests.length === 1 ? "" : "s"} · {presets.length} listening presets
            </p>
          </div>
          <form action={lockAdmin}>
            <button type="submit" className="rounded-lg border border-input px-3.5 py-2 text-[12.5px] font-medium text-muted-foreground hover:text-foreground">Lock admin mode</button>
          </form>
        </div>

        <section className="mb-8">
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Main-truth requests</h2>
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="grid bg-card px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:grid-cols-[2fr_1fr_1.4fr_0.8fr]">
              <div>Performance</div>
              <div>Submitted by</div>
              <div>Status</div>
              <div />
            </div>
            {requests.length === 0 && <p className="border-t border-border px-4 py-4 text-[13px] text-muted-foreground">No main-truth requests yet.</p>}
            {requests.map((request) => (
              <Link
                key={request.id}
                href={`/review/${request.performanceVideoId}?admin=1&request=${request.id}`}
                className="grid items-center gap-2 border-t border-border px-4 py-3.5 hover:bg-secondary/50 md:grid-cols-[2fr_1fr_1.4fr_0.8fr]"
              >
                <div className="text-[13.5px] font-medium text-foreground">{request.artist}</div>
                <div className="text-[12.5px] text-muted-foreground">{request.requesterName}</div>
                <div className={`font-mono text-[11px] uppercase tracking-wide ${request.status === "approved" ? "text-success" : request.status === "rejected" ? "text-primary" : "text-muted-foreground"}`}>{request.status}</div>
                <div className="text-right text-[12.5px] font-medium text-primary">Open →</div>
              </Link>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Pipeline review queue</h2>
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="grid bg-card px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:grid-cols-[2.2fr_0.9fr_2.3fr_0.8fr]">
              <div>Performance</div>
              <div>Confidence</div>
              <div>Why</div>
              <div />
            </div>
            {queue.length === 0 && <p className="border-t border-border px-4 py-4 text-[13px] text-muted-foreground">No performances need confirmation.</p>}
            {queue.map((item) => (
              <Link
                key={item.videoId}
                href={`/review/${item.videoId}?admin=1`}
                className="grid items-center gap-2 border-t border-border px-4 py-3.5 hover:bg-secondary/50 md:grid-cols-[2.2fr_0.9fr_2.3fr_0.8fr]"
              >
                <div className="text-[13.5px] font-medium text-foreground">{item.artist}</div>
                <div className={`font-mono text-[13px] font-semibold ${item.confidencePct < 70 ? "text-primary" : "text-muted-foreground"}`}>{item.confidencePct}%</div>
                <div className="text-[12.5px] text-muted-foreground">{item.whyText}</div>
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
                  <div className="text-[12px] text-muted-foreground">{preset.ownerName} · {preset.performanceVideoId} · {preset.status}</div>
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
