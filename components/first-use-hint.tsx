"use client";

import { useSyncExternalStore } from "react";

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("tiny-office:first-use-hint", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("tiny-office:first-use-hint", onStoreChange);
  };
}

function getSnapshot(storageKey: string) {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(storageKey) === "seen";
  } catch {
    return true;
  }
}

/** A small, dismissible note that is shown only until a visitor has seen it. */
export function FirstUseHint({
  storageKey,
  children,
  className = "",
}: {
  storageKey: string;
  children: React.ReactNode;
  className?: string;
}) {
  const seen = useSyncExternalStore(
    subscribe,
    () => getSnapshot(storageKey),
    () => true,
  );

  if (seen) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(storageKey, "seen");
      window.dispatchEvent(new Event("tiny-office:first-use-hint"));
    } catch {
      // Hints are optional; private browsing should not make the page noisy.
    }
  }

  return (
    <aside className={`rounded-lg border border-primary/30 bg-primary/5 px-3.5 py-3 ${className}`} aria-label="First-time hint">
      <div className="flex items-start gap-3">
        <p className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-foreground">{children}</p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 text-[11.5px] font-medium text-primary hover:underline"
        >
          Got it
        </button>
      </div>
    </aside>
  );
}
