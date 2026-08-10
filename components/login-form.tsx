"use client";

import { type FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { trackEvent } from "@/components/analytics";

type AuthMode = "signin" | "signup";

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<AuthMode>("signin");

  function getDestination() {
    const fallbackPath = window.location.pathname === "/login"
      ? "/playlists"
      : `${window.location.pathname}${window.location.search}`;
    return nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")
      ? nextPath
      : fallbackPath;
  }

  async function signInWithGoogle() {
    trackEvent({ eventName: "sign_in_started", source: "google_oauth" });
    setLoading(true);
    setMessage(null);

    const supabase = createClient();
    const siteUrl = window.location.origin;
    const destination = getDestination();
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

  async function handleEmailAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const formData = new FormData(event.currentTarget);
    const email = formData.get("email");
    const password = formData.get("password");
    if (typeof email !== "string" || typeof password !== "string") {
      setMessage("Enter your email and password.");
      return;
    }

    const source = mode === "signin" ? "email_password_signin" : "email_password_signup";
    trackEvent({ eventName: "sign_in_started", source });
    setLoading(true);
    setMessage(null);

    const supabase = createClient();
    const { data, error } = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    if (error) {
      setLoading(false);
      setMessage(error.message);
      return;
    }

    if (!data.session) {
      setLoading(false);
      setMessage(mode === "signup"
        ? "Account created, but email confirmation is enabled. Turn off Confirm email in Supabase Auth settings to use email/password without verification."
        : "Sign-in did not create a session. Try again.");
      return;
    }

    trackEvent({ eventName: "sign_in_completed", source });
    window.location.assign(getDestination());
  }

  return (
    <div className="flex max-w-[360px] flex-col gap-4">
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={loading}
        className="rounded-lg border border-input bg-secondary px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/80 disabled:cursor-wait disabled:opacity-60"
      >
        {loading ? "Working…" : "Continue with Google"}
      </button>

      <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70">
        <span className="h-px flex-1 bg-border" />
        <span>or use email</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="grid grid-cols-2 rounded-lg border border-border bg-secondary/40 p-1 text-xs font-semibold">
        {(["signin", "signup"] as const).map((authMode) => (
          <button
            key={authMode}
            type="button"
            onClick={() => {
              setMode(authMode);
              setMessage(null);
            }}
            disabled={loading}
            className={`rounded-md px-3 py-2 transition-colors disabled:cursor-wait disabled:opacity-60 ${
              mode === authMode ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {authMode === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form onSubmit={handleEmailAuth} className="flex flex-col gap-3">
        <div>
          <label htmlFor="login-email" className="text-xs font-medium text-foreground">Email</label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="mt-1.5 h-10 w-full rounded-lg border border-input bg-secondary px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20"
          />
        </div>
        <div>
          <label htmlFor="login-password" className="text-xs font-medium text-foreground">Password</label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            minLength={6}
            required
            className="mt-1.5 h-10 w-full rounded-lg border border-input bg-secondary px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:cursor-wait disabled:opacity-60"
        >
          {loading ? "Working…" : mode === "signin" ? "Sign in with email" : "Create account"}
        </button>
      </form>

      {message && <p role="alert" className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}
