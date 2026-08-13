import Link from "next/link";
import { Header } from "@/components/header";
import { CatalogGrid } from "@/components/catalog-grid";
import { AnalyticsOnMount } from "@/components/analytics";
import { PerformanceCard } from "@/components/performance-card";
import { YouTubeRequestSuggestions } from "@/components/youtube-request-suggestions";
import { getCurrentUser } from "@/lib/auth";
import { getBrowsePerformancePage, getPerformances, getPlaylists } from "@/lib/data";
import { fuzzySearch } from "@/lib/fuzzy-search";
import { searchYouTubeVideos } from "@/lib/youtube-search";

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const [catalogPage, searchPerformances, playlists, user] = await Promise.all([
    query ? Promise.resolve(null) : getBrowsePerformancePage(),
    query ? getPerformances() : Promise.resolve(null),
    getPlaylists(),
    getCurrentUser(),
  ]);
  const videoPlaylists = user
    ? playlists.filter((playlist) => playlist.ownerId === user.id && playlist.type === "videos")
    : [];
  const filteredPerformances = query
    ? fuzzySearch(
        searchPerformances ?? [],
        query,
        (performance) => [
          performance.artist,
          performance.sourceTitle,
          performance.videoId,
          ...performance.songs.map((song) => song.title),
        ].join(" "),
      )
    : catalogPage?.performances ?? [];
  const youtubeSuggestions = query && filteredPerformances.length === 0
    ? await searchYouTubeVideos(query)
    : [];

  return (
    <>
      <Header showBack={false} searchQuery={query} user={user} />
      <main className="p-4 sm:p-8">
        <AnalyticsOnMount event={query
          ? { eventName: "search_submitted", source: "search_results", queryLength: query.length, resultCount: filteredPerformances.length }
          : { eventName: "landing_viewed", source: "catalog" }} />
        <h1 className="text-[22px] font-semibold text-foreground mb-1">
          {query ? `Search results for “${query}”` : "Find your next Tiny Desk set"}
        </h1>
        <p className="text-[13.5px] text-muted-foreground mb-6">
          {query
            ? `${filteredPerformances.length} matching ${filteredPerformances.length === 1 ? "concert" : "concerts"}`
            : "Pick a performance, then start listening to a song right away."}
        </p>

        {!query && (
          <details className="mb-8 max-w-3xl">
            <summary className="flex w-fit cursor-pointer list-none items-center gap-2 rounded-lg border border-border bg-card/50 px-3.5 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground [&::-webkit-details-marker]:hidden">
              <span>About</span>
              <span aria-hidden className="text-base leading-none text-primary">+</span>
            </summary>
            <div className="mt-3 rounded-xl border border-border bg-card/50 p-4 sm:p-5">
              <h2 className="text-[14px] font-semibold text-foreground">
                About
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                Hi I&apos;m just a coder that is a big fan of Tiny Desk, and wanted a better way to listen to it while building a bigger community. I don&apos;t mean any harm to NPR or Tiny Desk, this is just a way I thought I could enhance some people&apos;s listening experience. If you have any feedback I am happy to receive it at{" "}
                <a className="text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:text-foreground" href="mailto:torazo.tokuda@gmail.com">
                  torazo.tokuda@gmail.com
                </a>
              </p>
            </div>
          </details>
        )}

        {!query && catalogPage ? (
          <CatalogGrid
            initialPerformances={catalogPage.performances}
            initialNextOffset={catalogPage.nextOffset}
            initialHasMore={catalogPage.hasMore}
            playlists={videoPlaylists}
            isSignedIn={Boolean(user)}
          />
        ) : filteredPerformances.length > 0 ? (
          <div
            className="grid gap-[22px]"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}
          >
            {filteredPerformances.map((p) => (
              <PerformanceCard
                key={p.videoId}
                performance={p}
                playlists={videoPlaylists}
                isSignedIn={Boolean(user)}
              />
            ))}
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-dashed border-border px-6 py-8 text-center">
              <p className="text-[13px] text-muted-foreground">No performances, artists, or songs match that search.</p>
              <p className="mt-2 text-[12.5px] text-muted-foreground/80">Try the YouTube results below, or request the video directly.</p>
              <Link
                href={`/song-request?q=${encodeURIComponent(query)}`}
                className="mt-4 inline-flex rounded-lg border border-input px-3.5 py-2 text-[12.5px] font-medium text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
              >
                Open song request page →
              </Link>
            </div>
            <YouTubeRequestSuggestions
              query={query}
              results={youtubeSuggestions}
              sourcePath={`/?q=${encodeURIComponent(query)}`}
            />
          </>
        )}
      </main>
    </>
  );
}
