"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import type { TruthRequestSummary } from "@/lib/types";

export function TruthRequestNotification({ request }: { request: TruthRequestSummary }) {
  const storageKey = `tiny-office:truth-request-notification:${request.id}`;
  const dismissedEvent = `${storageKey}:changed`;
  const dismissed = useSyncExternalStore(
    (notify) => {
      window.addEventListener(dismissedEvent, notify);
      return () => window.removeEventListener(dismissedEvent, notify);
    },
    () => window.localStorage.getItem(storageKey) === "dismissed",
    () => false,
  );

  if (dismissed) return null;

  const approved = request.status === "approved";

  function dismiss() {
    window.localStorage.setItem(storageKey, "dismissed");
    window.dispatchEvent(new Event(dismissedEvent));
  }

  return (
    <div className={`border-b px-4 py-2.5 sm:px-8 ${approved ? "border-success/30 bg-success/10" : "border-primary/30 bg-primary/10"}`} role="status" aria-live="polite">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-2 text-[12.5px] sm:flex-nowrap sm:gap-3">
        <span aria-hidden className={`text-base ${approved ? "text-success" : "text-primary"}`}>{approved ? "✓" : "!"}</span>
        <p className="min-w-0 flex-1 text-foreground">
          {approved
            ? `Your timeline was approved — thank you for helping improve Tiny Office!`
            : `Your main-truth request for ${request.artist} was rejected.`}
        </p>
        <Link href={`/review/${request.performanceVideoId}`} className="shrink-0 font-medium text-primary hover:underline">
          View timeline →
        </Link>
        <button type="button" onClick={dismiss} className="shrink-0 px-1 text-muted-foreground hover:text-foreground" aria-label="Dismiss notification">
          ×
        </button>
      </div>
    </div>
  );
}
