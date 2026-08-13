import type { Metadata } from "next";
import { Header } from "@/components/header";
import { SongRequestForm } from "@/components/song-request-form";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Song request | Tiny Office",
  description: "Request a Tiny Desk performance for the Tiny Office import queue.",
};

export default async function SongRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim().slice(0, 200) ?? "";
  const user = await getCurrentUser();

  return (
    <>
      <Header searchQuery={query} user={user} />
      <main className="mx-auto w-full max-w-6xl p-4 sm:p-8">
        <div className="max-w-2xl">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">TinyOffice requests</p>
          <h1 className="mt-2 text-[26px] font-semibold tracking-tight text-foreground">Song request</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
            Can&apos;t find a Tiny Desk performance in the catalog? Tell me what you&apos;re looking for and I&apos;ll add it to the import list.
          </p>
        </div>

        <section className="mt-8 max-w-2xl rounded-xl border border-border bg-card/60 p-4 sm:p-5" aria-labelledby="manual-request-title">
          <h2 id="manual-request-title" className="text-[15px] font-semibold text-foreground">What should I add?</h2>
          <p className="mt-1 mb-4 text-[13px] leading-relaxed text-muted-foreground">No sign-in required. Requests are checked from the admin dashboard.</p>
          <SongRequestForm initialQuery={query} />
        </section>
      </main>
    </>
  );
}
