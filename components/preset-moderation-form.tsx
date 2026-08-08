"use client";

import { useActionState } from "react";
import { hideListeningPreset, type ReviewActionState } from "@/app/review/actions";

export function PresetModerationForm({ presetId, status }: { presetId: string; status: "published" | "hidden" }) {
  const [state, action, pending] = useActionState<ReviewActionState, FormData>(hideListeningPreset, null);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="preset_id" value={presetId} />
      <button type="submit" disabled={pending} className="text-[12px] font-medium text-primary hover:underline disabled:opacity-60">
        {pending ? "Saving…" : status === "hidden" ? "Publish" : "Hide"}
      </button>
      {state?.error && <span className="text-[11px] text-primary">{state.error}</span>}
    </form>
  );
}
