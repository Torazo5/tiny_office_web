import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center p-4 sm:p-8">
      <section className="w-full max-w-[520px] rounded-xl border border-border bg-card p-6 text-center">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          404
        </p>
        <h1 className="mt-2 text-xl font-semibold text-foreground">That page wandered off.</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          We couldn&apos;t find that performance, playlist, or review page.
        </p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-foreground"
        >
          Back to browse
        </Link>
      </section>
    </main>
  );
}
