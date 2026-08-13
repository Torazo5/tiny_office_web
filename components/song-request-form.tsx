"use client";

import { useActionState } from "react";
import { submitSongRequest, type SongRequestActionState } from "@/app/song-request/actions";

export function SongRequestForm({
  initialQuery = "",
  sourcePath = "/song-request",
}: {
  initialQuery?: string;
  sourcePath?: string;
}) {
  const [state, action, pending] = useActionState<SongRequestActionState, FormData>(submitSongRequest, null);

  if (state?.success) {
    return (
      <div className="rounded-xl border border-success/30 bg-success/10 p-4" role="status">
        <p className="text-[14px] font-semibold text-foreground">Request saved.</p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{state.success}</p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <div>
        <label htmlFor="song-request-query" className="text-[12.5px] font-semibold text-foreground">
          What should we look for?
        </label>
        <input
          id="song-request-query"
          name="query"
          defaultValue={initialQuery}
          maxLength={200}
          required
          placeholder="Artist, concert, or video title"
          className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-[13.5px] text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary focus:ring-3 focus:ring-primary/20"
        />
      </div>
      <div>
        <label htmlFor="song-request-note" className="text-[12.5px] font-semibold text-foreground">
          Anything helpful? <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <textarea
          id="song-request-note"
          name="note"
          maxLength={1000}
          rows={4}
          placeholder="A date, a venue, or a link you found elsewhere"
          className="mt-1.5 w-full resize-y rounded-lg border border-input bg-background px-3 py-2.5 text-[13.5px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary focus:ring-3 focus:ring-primary/20"
        />
      </div>
      <input type="hidden" name="source_path" value={sourcePath} />
      <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="song-request-website">Website</label>
        <input id="song-request-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] leading-relaxed text-muted-foreground">No sign-in required.</p>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Saving…" : "Send request"}
        </button>
      </div>
      {state?.error && <p className="text-[12px] text-primary" role="alert">{state.error}</p>}
    </form>
  );
}
