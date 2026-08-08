"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    setLoading(true);
    setMessage(null);

    const supabase = createClient();
    const siteUrl = window.location.origin;
    const fallbackPath = window.location.pathname === "/login"
      ? "/playlists"
      : `${window.location.pathname}${window.location.search}`;
    const destination = nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")
      ? nextPath
      : fallbackPath;
    const redirectTo = `${siteUrl}/auth/callback?next=${encodeURIComponent(destination || "/playlists")}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (error) {
      setLoading(false);
      setMessage(error.message);
    }
  }

  return (
    <div className="flex max-w-[360px] flex-col gap-3">
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={loading}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {loading ? "Redirecting…" : "Continue with Google"}
      </button>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}
