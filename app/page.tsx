import { Header } from "@/components/header";
import { CatalogGrid } from "@/components/catalog-grid";
import { AnalyticsOnMount } from "@/components/analytics";
import { PerformanceCard } from "@/components/performance-card";
import { getCurrentUser } from "@/lib/auth";
import { getBrowsePerformancePage, getPerformances, getPlaylists } from "@/lib/data";
import { fuzzySearch } from "@/lib/fuzzy-search";

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
          <p className="rounded-xl border border-dashed border-border px-6 py-14 text-center text-[13px] text-muted-foreground">
            No performances, artists, or songs match that search.
          </p>
        )}
      </main>
    </>
  );
}
