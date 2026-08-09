"use client";

import Link from "next/link";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-[60vh] items-center justify-center p-4 sm:p-8">
      <section className="w-full max-w-[520px] rounded-xl border border-primary/30 bg-card p-6 text-center">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-primary">
          Playback interrupted
        </p>
        <h1 className="mt-2 text-xl font-semibold text-foreground">Tiny Office hit a snag.</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          The page could not finish loading. Try again, or head back to the performance catalogue.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-foreground"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-lg border border-border px-3.5 py-2 text-[12.5px] font-medium text-muted-foreground hover:text-foreground"
          >
            Back to browse
          </Link>
        </div>
      </section>
    </main>
  );
}
