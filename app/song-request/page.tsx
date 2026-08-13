import type { Metadata } from "next";
import { Header } from "@/components/header";
import { SongRequestForm } from "@/components/song-request-form";
import { YouTubeRequestSuggestions } from "@/components/youtube-request-suggestions";
import { getCurrentUser } from "@/lib/auth";
import { isYouTubeSearchConfigured, searchYouTubeVideos } from "@/lib/youtube-search";

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
  const [user, results] = await Promise.all([
    getCurrentUser(),
    query ? searchYouTubeVideos(query) : Promise.resolve([]),
  ]);
  const youtubeConfigured = isYouTubeSearchConfigured();

  return (
    <>
      <Header searchQuery={query} user={user} />
      <main className="mx-auto w-full max-w-6xl p-4 sm:p-8">
        <div className="max-w-2xl">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">TinyOffice requests</p>
          <h1 className="mt-2 text-[26px] font-semibold tracking-tight text-foreground">Song request</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
            Can&apos;t find a Tiny Desk performance in the catalog? Search YouTube for the exact video, or leave a note and I&apos;ll look for it later.
          </p>
        </div>

        <section className="mt-8 max-w-2xl rounded-xl border border-border bg-card/60 p-4 sm:p-5" aria-labelledby="song-request-search-title">
          <h2 id="song-request-search-title" className="text-[15px] font-semibold text-foreground">Find the exact video</h2>
          <form action="/song-request" method="get" className="mt-3 flex flex-col gap-2.5 sm:flex-row">
            <label htmlFor="song-request-search" className="sr-only">Search YouTube</label>
            <input
              id="song-request-search"
              type="search"
              name="q"
              defaultValue={query}
              maxLength={200}
              required
              placeholder="Artist, concert, or video title"
              className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-[13.5px] text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary focus:ring-3 focus:ring-primary/20"
            />
            <button type="submit" className="h-10 rounded-lg bg-primary px-4 text-[12.5px] font-semibold text-primary-foreground transition-opacity hover:opacity-90">Search YouTube</button>
          </form>
          {!youtubeConfigured && <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">YouTube search is being configured. You can still send a manual request below.</p>}
        </section>

        {query && results.length > 0 && (
          <YouTubeRequestSuggestions query={query} results={results} sourcePath={`/song-request?q=${encodeURIComponent(query)}`} />
        )}

        {query && youtubeConfigured && results.length === 0 && (
          <p className="mt-6 max-w-2xl rounded-xl border border-dashed border-border px-5 py-4 text-[13px] text-muted-foreground">
            I couldn&apos;t find a confident YouTube match. Send the request below with any extra details you know.
          </p>
        )}

        <section className="mt-8 max-w-2xl rounded-xl border border-border bg-card/60 p-4 sm:p-5" aria-labelledby="manual-request-title">
          <h2 id="manual-request-title" className="text-[15px] font-semibold text-foreground">Request it manually</h2>
          <p className="mt-1 mb-4 text-[13px] leading-relaxed text-muted-foreground">No sign-in required. Requests are checked from the admin dashboard.</p>
          <SongRequestForm initialQuery={query} />
        </section>
      </main>
    </>
  );
}
