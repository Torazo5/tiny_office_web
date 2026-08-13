import Link from "next/link";
import { SearchForm } from "@/components/search-form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getCurrentUser } from "@/lib/auth";
import { getUserProfile } from "@/lib/profile-data";
import { TruthRequestNotification } from "@/components/truth-request-notification";
import { getLatestResolvedTruthRequest } from "@/lib/review-data";
import { isAdminSession } from "@/lib/admin-session";
import { signOut } from "@/app/auth/actions";
import { FeedbackButton } from "@/components/feedback-button";
import { Dices } from "lucide-react";

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
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-border px-4 py-3 lg:flex-nowrap lg:gap-6 lg:px-8 lg:py-4">
      <Link
        href="/"
        className="order-1 shrink-0 font-sans text-[19px] font-bold tracking-tight text-foreground whitespace-nowrap lg:order-none"
      >
        Tiny<span className="text-primary">Office</span>
      </Link>

      <nav className="order-3 flex min-w-0 basis-full items-center gap-2 overflow-x-auto pb-0.5 lg:order-none lg:basis-auto lg:overflow-visible">
        {showBack && (
          <Link
            href="/"
            className="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <span aria-hidden>&larr;</span> Browse
          </Link>
        )}

        <Link
          href="/playlists"
          className="shrink-0 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Playlists
        </Link>

        <Link
          href="/song-request"
          className="shrink-0 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Song request
        </Link>

        {user && (
          <Link
            href="/liked-songs"
            className="shrink-0 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Liked songs
          </Link>
        )}

        <Link
          href="/random-pick"
          className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md border border-border bg-secondary/45 px-2.5 py-1.5 text-sm font-semibold text-foreground transition-colors hover:border-yellow-400/45 hover:bg-yellow-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Dices
            aria-hidden
            className="size-4 text-yellow-400"
            strokeWidth={2}
          />
          Random pick
          <span className="rounded-full border border-yellow-400/35 bg-yellow-400/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-yellow-300">
            Recommended
          </span>
        </Link>

        {user && isAdmin && (
          <Link
            href="/review"
            className="shrink-0 text-sm font-medium text-primary transition-colors hover:text-foreground"
          >
            Admin dashboard
          </Link>
        )}
      </nav>

      <SearchForm searchQuery={searchQuery} />

      <div className="hidden lg:block lg:flex-1" />

      {progressLabel && (
        <div className="hidden whitespace-nowrap rounded-full border border-border bg-secondary px-3 py-1.5 font-mono text-xs font-semibold text-muted-foreground lg:block">
          {progressLabel}
        </div>
      )}

      <div className="order-1 ml-auto flex shrink-0 items-center gap-2 lg:order-none lg:ml-0 lg:gap-3">
      {user ? (
        <form action={signOut} className="flex items-center gap-2 lg:gap-3">
          {profile && (
            <Link
              href="/profile"
              className="flex min-h-9 items-center gap-2 rounded-lg px-1.5 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label={`Open ${profile.displayName}'s profile`}
            >
              <Avatar size="sm">
                <AvatarImage src={profile.avatarUrl} alt="" />
                <AvatarFallback>{profile.displayName.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[150px] truncate lg:inline">{profile.displayName}</span>
              <span className="hidden text-xs text-muted-foreground/70 lg:inline">Profile</span>
            </Link>
          )}
          <button
            type="submit"
            className="min-h-9 whitespace-nowrap rounded-lg border border-input px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground lg:px-4"
          >
            Sign out
          </button>
        </form>
      ) : (
        <Link
          href="/login"
          className="inline-flex min-h-9 items-center whitespace-nowrap rounded-lg border border-input px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground lg:px-4"
        >
          Sign in
        </Link>
      )}
      </div>
      </header>
      <FeedbackButton />
    </>
  );
}
