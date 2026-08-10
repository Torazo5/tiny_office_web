"use client";

import { useActionState } from "react";
import { updateProfile, type ProfileActionState } from "@/app/profile/actions";

export function ProfileSettings({
  displayName,
  tag,
}: {
  displayName: string;
  tag: string;
}) {
  const [state, action, pending] = useActionState<ProfileActionState, FormData>(updateProfile, null);

  return (
    <section className="rounded-xl border border-border bg-card/50 p-5">
      <div className="mb-4">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Public profile</h2>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Choose what other listeners see. Your account email stays private.
        </p>
      </div>
      <form action={action} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="profile-display-name" className="text-[12px] font-medium text-foreground">
            Display name
          </label>
          <input
            id="profile-display-name"
            name="display_name"
            type="text"
            defaultValue={displayName}
            maxLength={40}
            required
            className="mt-1.5 h-9 w-full rounded-lg border border-input bg-secondary px-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20"
          />
        </div>
        <div>
          <label htmlFor="profile-tag" className="text-[12px] font-medium text-foreground">
            Tag
          </label>
          <div className="mt-1.5 flex h-9 items-center rounded-lg border border-input bg-secondary px-2.5 focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/20">
            <span className="text-sm text-muted-foreground">@</span>
            <input
              id="profile-tag"
              name="tag"
              type="text"
              defaultValue={tag}
              minLength={3}
              maxLength={24}
              pattern="[a-zA-Z0-9_]{3,24}"
              required
              className="min-w-0 flex-1 bg-transparent px-1 text-sm text-foreground outline-none"
            />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">3–24 letters, numbers, or underscores.</p>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-lg bg-primary px-3.5 text-[12.5px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save profile"}
        </button>
      </form>
      {state?.error && <p className="mt-3 text-[12px] text-primary">{state.error}</p>}
      {state?.success && <p className="mt-3 text-[12px] text-success">{state.success}</p>}
    </section>
  );
}
