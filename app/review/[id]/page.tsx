import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminUnlockForm } from "@/components/admin-unlock-form";
import { RevisionEditor } from "@/components/revision-editor";
import { Header } from "@/components/header";
import { getCurrentUser } from "@/lib/auth";
import { isAdminSession } from "@/lib/admin-session";
import { getAdminTruthRequest, getMyTruthRequests, getPerformanceForRevision } from "@/lib/review-data";
import type { PerformanceCutKey } from "@/lib/types";

function readCutKey(value: string | undefined): PerformanceCutKey | null {
  return value === "no-audience" || value === "with-audience" ? value : null;
}

export default async function ReviewFlowPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ admin?: string; request?: string; cut?: string }>;
}) {
  const { id } = await params;
  const { admin: adminIntent, request: requestId, cut } = await searchParams;
  const requestedCut = readCutKey(cut);
  const [initialRevision, user] = await Promise.all([getPerformanceForRevision(id, "no-audience"), getCurrentUser()]);
  if (!initialRevision.performance) notFound();

  if (!user) {
    const nextQuery = new URLSearchParams();
    if (adminIntent) nextQuery.set("admin", "1");
    if (requestId) nextQuery.set("request", requestId);
    if (requestedCut) nextQuery.set("cut", requestedCut);
    const nextPath = `/review/${id}${nextQuery.toString() ? `?${nextQuery.toString()}` : ""}`;
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  const isAdmin = await isAdminSession(user.id);
  const requestData = isAdmin && requestId ? await getAdminTruthRequest(requestId) : null;
  const myRequests = user && !isAdmin ? await getMyTruthRequests(user.id) : [];
  const targetCut = requestData?.request.variantKey ?? requestedCut;
  const revision = targetCut && targetCut !== "no-audience"
    ? await getPerformanceForRevision(id, targetCut)
    : initialRevision;
  const performance = revision.performance;
  if (!performance) notFound();

  return (
    <>
      <Header progressLabel={targetCut && revision.variant ? `Revision editor · ${revision.variant.name}` : "Choose a ground truth"} user={user} />
      <main className="mx-auto w-full max-w-[980px] p-4 sm:p-8">
        {adminIntent && !isAdmin && (
          <div className="mb-5 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="text-[13px] font-semibold text-foreground">Admin access</div>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Sign in and enter the admin password to review requests or change main truth.
            </p>
            <AdminUnlockForm />
          </div>
        )}

        {isAdmin && requestId && !requestData && (
          <div className="mb-5 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm text-primary">
            That truth request could not be found.
          </div>
        )}

        {!targetCut && !requestData && (
          <section className="mx-auto max-w-[680px] rounded-[10px] border border-border bg-card p-5">
            <h1 className="text-xl font-semibold text-foreground">Choose the ground truth to revise</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">These are separate timelines with different timestamps. Choose one before editing so your correction reaches the right ground truth.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {initialRevision.cutVariants.map((variant) => (
                <Link
                  key={variant.key}
                  href={`/review/${id}?cut=${variant.key}${adminIntent ? "&admin=1" : ""}`}
                  className="rounded-lg border border-border p-4 transition-colors hover:border-primary/50 hover:bg-primary/[0.04]"
                >
                  <div className="text-[14px] font-semibold text-foreground">{variant.name}</div>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{variant.description}</p>
                  <span className="mt-3 inline-block text-[12px] font-medium text-primary">Revise this timeline →</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {targetCut && revision.variant && (
          <RevisionEditor
            performance={performance}
            variant={revision.variant}
            isSignedIn={Boolean(user)}
            isAdmin={isAdmin}
            request={requestData?.request ?? null}
            initialDraft={requestData?.draft}
          />
        )}

        {!isAdmin && user && myRequests.length > 0 && (
          <section className="mt-8 border-t border-border pt-5">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Your main-truth requests</h2>
            <div className="mt-3 flex flex-col gap-2">
              {myRequests
                .filter((request) => request.performanceVideoId === id)
                .map((request) => (
                  <div key={request.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card/50 px-3.5 py-3">
                    <div>
                      <div className="text-[13px] font-medium text-foreground">Submitted {new Date(request.createdAt).toLocaleDateString()} · {request.variantKey === "no-audience" ? "No audience" : "With applause"}</div>
                      {request.note && <div className="mt-0.5 text-[12px] text-muted-foreground">{request.note}</div>}
                    </div>
                    <span className={`font-mono text-[11px] uppercase tracking-wide ${request.status === "approved" ? "text-success" : request.status === "rejected" ? "text-primary" : "text-muted-foreground"}`}>
                      {request.status}
                    </span>
                  </div>
                ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
