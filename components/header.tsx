import Link from "next/link";
import { Input } from "@/components/ui/input";
import { getCurrentUser } from "@/lib/auth";
import { TruthRequestNotification } from "@/components/truth-request-notification";
import { getMyTruthRequests } from "@/lib/review-data";
import { isAdminSession } from "@/lib/admin-session";
import { signOut } from "@/app/auth/actions";

/**
 * Shared header, per the design handoff. Rendered explicitly at the top of
 * each page (not in the root layout) because the one variant prop that
 * changes per-screen — `progressLabel`, only used on the review flow — is
 * page-specific data a root layout can't easily see.
 *
 * Search input is decorative for now — wiring it to real search needs a
 * backend to search against.
 */
export async function Header({
  showBack = true,
  progressLabel,
}: {
  showBack?: boolean;
  progressLabel?: string;
}) {
  const user = await getCurrentUser();
  const latestResolvedRequest = user
    ? (await getMyTruthRequests(user.id)).find((request) => request.status !== "pending")
    : null;
  const isAdmin = Boolean(user && (await isAdminSession(user.id)));

  return (
    <>
      {latestResolvedRequest && <TruthRequestNotification request={latestResolvedRequest} />}
      <header className="flex items-center gap-6 px-8 py-4 border-b border-border">
      <Link
        href="/"
        className="font-sans font-bold text-[19px] tracking-tight text-foreground whitespace-nowrap"
      >
        Tiny<span className="text-primary">Office</span>
      </Link>

      {showBack && (
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-md transition-colors"
        >
          <span aria-hidden>&larr;</span> Browse
        </Link>
      )}

      <Link
        href="/playlists"
        className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        Playlists
      </Link>

      {user && (
        <Link
          href="/profile"
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Profile
        </Link>
      )}

      {user && isAdmin && (
        <Link
          href="/review"
          className="text-sm font-medium text-primary hover:text-foreground transition-colors"
        >
          Admin dashboard
        </Link>
      )}

      <div className="flex-1 max-w-[420px]">
        <Input
          placeholder="Search performances, artists, songs"
          className="bg-secondary"
          disabled
        />
      </div>

      <div className="flex-1" />

      {progressLabel && (
        <div className="font-mono text-xs font-semibold text-muted-foreground bg-secondary border border-border px-3 py-1.5 rounded-full whitespace-nowrap">
          {progressLabel}
        </div>
      )}

      {user ? (
        <form action={signOut} className="flex items-center gap-3">
          <span className="max-w-[180px] truncate text-sm text-muted-foreground">{user.email}</span>
          <button
            type="submit"
            className="whitespace-nowrap rounded-lg border border-input px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Sign out
          </button>
        </form>
      ) : (
        <Link
          href="/login"
          className="whitespace-nowrap rounded-lg border border-input px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Sign in
        </Link>
      )}
      </header>
    </>
  );
}
