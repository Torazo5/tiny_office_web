"use client";

import { useActionState } from "react";
import { updateSongRequestStatus, type SongRequestActionState } from "@/app/song-request/actions";
import type { SongRequestStatus } from "@/lib/song-request-data";

function label(status: SongRequestStatus) {
  return status === "in_progress" ? "In progress" : status[0].toUpperCase() + status.slice(1);
}

export function SongRequestModerationForm({ requestId, status }: { requestId: string; status: SongRequestStatus }) {
  const [state, action, pending] = useActionState<SongRequestActionState, FormData>(updateSongRequestStatus, null);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <span className={`font-mono text-[10px] uppercase tracking-wide ${status === "imported" ? "text-success" : status === "rejected" ? "text-primary" : "text-muted-foreground"}`}>
        {label(status)}
      </span>
      <form action={action} className="flex flex-wrap justify-end gap-2">
        <input type="hidden" name="request_id" value={requestId} />
        {(status === "pending" || status === "rejected") && (
          <button type="submit" name="status" value={status === "rejected" ? "pending" : "in_progress"} disabled={pending} className="text-[12px] font-medium text-primary hover:underline disabled:opacity-60">
            {pending ? "Saving…" : status === "rejected" ? "Reopen" : "Start import"}
          </button>
        )}
        {(status === "pending" || status === "in_progress") && (
          <button type="submit" name="status" value="imported" disabled={pending} className="text-[12px] font-medium text-success hover:underline disabled:opacity-60">
            {pending ? "Saving…" : "Mark imported"}
          </button>
        )}
        {status !== "rejected" && (
          <button type="submit" name="status" value="rejected" disabled={pending} className="text-[12px] font-medium text-muted-foreground hover:text-primary disabled:opacity-60">
            Reject
          </button>
        )}
        {status === "in_progress" && (
          <button type="submit" name="status" value="pending" disabled={pending} className="text-[12px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-60">
            Pause
          </button>
        )}
      </form>
      {state?.error && <span className="basis-full text-right text-[11px] text-primary" role="alert">{state.error}</span>}
    </div>
  );
}
