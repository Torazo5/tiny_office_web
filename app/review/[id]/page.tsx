import { notFound, redirect } from "next/navigation";
import { AdminUnlockForm } from "@/components/admin-unlock-form";
import { RevisionEditor } from "@/components/revision-editor";
import { Header } from "@/components/header";
import { getCurrentUser } from "@/lib/auth";
import { getPerformance } from "@/lib/data";
import { isAdminSession } from "@/lib/admin-session";
import { getAdminTruthRequest, getMyTruthRequests } from "@/lib/review-data";

export default async function ReviewFlowPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ admin?: string; request?: string }>;
}) {
  const { id } = await params;
  const { admin: adminIntent, request: requestId } = await searchParams;
  const [performance, user] = await Promise.all([getPerformance(id), getCurrentUser()]);
  if (!performance) notFound();

  if (!user) {
    const nextQuery = new URLSearchParams();
    if (adminIntent) nextQuery.set("admin", "1");
    if (requestId) nextQuery.set("request", requestId);
    const nextPath = `/review/${id}${nextQuery.toString() ? `?${nextQuery.toString()}` : ""}`;
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  const isAdmin = await isAdminSession(user.id);
  const requestData = isAdmin && requestId ? await getAdminTruthRequest(requestId) : null;
  const myRequests = user && !isAdmin ? await getMyTruthRequests(user.id) : [];

  return (
    <>
      <Header progressLabel={`Revision editor · ${performance.songs.length} songs`} user={user} />
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

        <RevisionEditor
          performance={performance}
          isSignedIn={Boolean(user)}
          isAdmin={isAdmin}
          request={requestData?.request ?? null}
          initialDraft={requestData?.draft}
        />

        {!isAdmin && user && myRequests.length > 0 && (
          <section className="mt-8 border-t border-border pt-5">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Your main-truth requests</h2>
            <div className="mt-3 flex flex-col gap-2">
              {myRequests
                .filter((request) => request.performanceVideoId === id)
                .map((request) => (
                  <div key={request.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card/50 px-3.5 py-3">
                    <div>
                      <div className="text-[13px] font-medium text-foreground">Submitted {new Date(request.createdAt).toLocaleDateString()}</div>
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
