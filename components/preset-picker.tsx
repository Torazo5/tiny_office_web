"use client";

import { useActionState } from "react";
import { selectListeningPreset, type ReviewActionState } from "@/app/review/actions";
import type { ListeningPreset } from "@/lib/types";

export function PresetPicker({
  videoId,
  presets,
  selectedPresetId,
  isSignedIn,
}: {
  videoId: string;
  presets: ListeningPreset[];
  selectedPresetId: string | null;
  isSignedIn: boolean;
}) {
  const [state, action, pending] = useActionState<ReviewActionState, FormData>(selectListeningPreset, null);

  if (presets.length === 0) return null;

  return (
    <div className="mb-5 rounded-lg border border-border bg-card/60 p-3.5">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <div>
          <div className="text-[13px] font-semibold text-foreground">Listening presets</div>
          <p className="text-[11.5px] text-muted-foreground">
            Try another listener&apos;s timeline without changing main truth.
          </p>
        </div>
        {!isSignedIn && <span className="text-[11px] text-muted-foreground">Preview only</span>}
      </div>

      <form
        action={isSignedIn ? action : `/video/${videoId}`}
        method={isSignedIn ? undefined : "get"}
        className="flex flex-wrap items-center gap-2"
      >
        <select
          name="preset_id"
          defaultValue={selectedPresetId ?? "ground-truth"}
          className="h-9 min-w-[220px] flex-1 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="ground-truth">Main truth</option>
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name} · {preset.ownerName}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-input px-3.5 py-2 text-[12.5px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"
        >
          {isSignedIn ? (pending ? "Saving…" : "Use this preset") : "Preview"}
        </button>
      </form>
      {state?.error && <p className="mt-2 text-[12px] text-primary">{state.error}</p>}
      {state?.success && <p className="mt-2 text-[12px] text-success">{state.success}</p>}
    </div>
  );
}
