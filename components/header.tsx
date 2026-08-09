import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getCurrentUser } from "@/lib/auth";
import { getUserProfile } from "@/lib/profile-data";
import { TruthRequestNotification } from "@/components/truth-request-notification";
import { getLatestResolvedTruthRequest } from "@/lib/review-data";
import { isAdminSession } from "@/lib/admin-session";
import { signOut } from "@/app/auth/actions";
import { WandSparkles } from "lucide-react";

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
          href="/adventure"
          className="group relative inline-flex shrink-0 items-center gap-2 overflow-hidden whitespace-nowrap rounded-full border border-primary/35 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary shadow-[0_0_18px_oklch(0.68_0.17_25_/_0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/70 hover:bg-primary/15 hover:shadow-[0_0_22px_oklch(0.68_0.17_25_/_0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-12 -translate-x-full skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-[310%]"
          />
          <WandSparkles
            aria-hidden
            className="relative size-4 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110"
            strokeWidth={2.2}
          />
          I&apos;m feeling adventurous
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

      <form action="/" method="get" className="order-2 min-w-0 basis-full lg:order-none lg:flex-1 lg:basis-auto lg:max-w-[420px]">
        <Input
          type="search"
          name="q"
          defaultValue={searchQuery}
          placeholder="Search performances, artists, songs"
          className="bg-secondary"
          aria-label="Search performances, artists, and songs"
        />
      </form>

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
    </>
  );
}
