import { Header } from "@/components/header";
import { PerformanceCard } from "@/components/performance-card";
import { getCurrentUser } from "@/lib/auth";
import { getPerformances, getPlaylists } from "@/lib/data";

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const [performances, playlists, user] = await Promise.all([
    getPerformances(),
    getPlaylists(),
    getCurrentUser(),
  ]);
  const videoPlaylists = user
    ? playlists.filter((playlist) => playlist.ownerId === user.id && playlist.type === "videos")
    : [];
  const filteredPerformances = query
    ? performances.filter((performance) =>
        [performance.artist, performance.videoId, ...performance.songs.map((song) => song.title)]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase()),
      )
    : performances;

  return (
    <>
      <Header showBack={false} searchQuery={query} user={user} />
      <main className="p-4 sm:p-8">
        <h1 className="text-[22px] font-semibold text-foreground mb-1">
          {query ? `Search results for “${query}”` : "Browse performances"}
        </h1>
        <p className="text-[13.5px] text-muted-foreground mb-6">
          {query
            ? `${filteredPerformances.length} matching ${filteredPerformances.length === 1 ? "concert" : "concerts"}`
            : `${performances.length} concerts, individually playable by song`}
        </p>

        {filteredPerformances.length > 0 ? (
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
