"use client";

import Link from "next/link";

export function PlaylistSignInGate({ nextPath }: { nextPath: string }) {
  return (
    <div className="mx-auto max-w-[560px] rounded-xl border border-dashed border-border px-6 py-16 text-center">
      <h1 className="text-xl font-semibold text-foreground">Sign in to view your playlists</h1>
      <p className="mx-auto mt-2 max-w-[420px] text-sm text-muted-foreground">
        Playlists are private to your account. Sign in to open this playlist area and manage your saved songs and videos.
      </p>
      <Link
        href={{ pathname: "/login", query: { next: nextPath } }}
        className="mt-6 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      >
        Sign in to continue
      </Link>
    </div>
  );
}
