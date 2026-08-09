import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getCurrentUser } from "@/lib/auth";
import { getUserProfile } from "@/lib/profile-data";
import { TruthRequestNotification } from "@/components/truth-request-notification";
import { getLatestResolvedTruthRequest } from "@/lib/review-data";
import { isAdminSession } from "@/lib/admin-session";
import { signOut } from "@/app/auth/actions";

/**
 * Shared header, per the design handoff. Rendered explicitly at the top of
 * each page (not in the root layout) because the one variant prop that
 * changes per-screen — `progressLabel`, only used on the review flow — is
 * page-specific data a root layout can't easily see.
 *
 */
export async function Header({
  showBack = true,
  progressLabel,
  searchQuery = "",
  user: currentUser,
}: {
  showBack?: boolean;
  progressLabel?: string;
  searchQuery?: string;
  user?: Awaited<ReturnType<typeof getCurrentUser>>;
}) {
  const user = currentUser === undefined ? await getCurrentUser() : currentUser;
  const [latestResolvedRequest, isAdmin, profile] = user
    ? await Promise.all([
        getLatestResolvedTruthRequest(user.id),
        isAdminSession(user.id),
        getUserProfile(user.id),
      ])
    : ([null, false, null] as const);

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

      <Link
        href="/adventure"
        className="whitespace-nowrap text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        I&apos;m feeling adventurous
      </Link>

      {user && isAdmin && (
        <Link
          href="/review"
          className="text-sm font-medium text-primary hover:text-foreground transition-colors"
        >
          Admin dashboard
        </Link>
      )}

      <form action="/" method="get" className="flex-1 max-w-[420px]">
        <Input
          type="search"
          name="q"
          defaultValue={searchQuery}
          placeholder="Search performances, artists, songs"
          className="bg-secondary"
          aria-label="Search performances, artists, and songs"
        />
      </form>

      <div className="flex-1" />

      {progressLabel && (
        <div className="font-mono text-xs font-semibold text-muted-foreground bg-secondary border border-border px-3 py-1.5 rounded-full whitespace-nowrap">
          {progressLabel}
        </div>
      )}

      {user ? (
        <form action={signOut} className="flex items-center gap-3">
          {profile && (
            <Link
              href="/profile"
              className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label={`Open ${profile.displayName}'s profile`}
            >
              <Avatar size="sm">
                <AvatarImage src={profile.avatarUrl} alt="" />
                <AvatarFallback>{profile.displayName.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="max-w-[150px] truncate">{profile.displayName}</span>
              <span className="hidden text-xs text-muted-foreground/70 sm:inline">Profile</span>
            </Link>
          )}
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
