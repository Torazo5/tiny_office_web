"use client";

import { useActionState } from "react";
import { unlockAdmin, type ReviewActionState } from "@/app/review/actions";

export function AdminUnlockForm() {
  const [state, action, pending] = useActionState<ReviewActionState, FormData>(unlockAdmin, null);

  return (
    <form action={action} className="mt-4 flex max-w-[360px] flex-col gap-2">
      <label htmlFor="admin-password" className="text-[12px] font-medium text-muted-foreground">
        Admin password
      </label>
      <div className="flex gap-2">
        <input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {pending ? "Checking…" : "Unlock"}
        </button>
      </div>
      {state?.error && <p className="text-sm text-primary">{state.error}</p>}
    </form>
  );
}
