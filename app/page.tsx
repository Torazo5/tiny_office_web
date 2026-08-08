import { Header } from "@/components/header";
import { PerformanceCard } from "@/components/performance-card";
import { getCurrentUser } from "@/lib/auth";
import { getPerformances, getPlaylists } from "@/lib/data";

export default async function BrowsePage() {
  const [performances, playlists, user] = await Promise.all([
    getPerformances(),
    getPlaylists(),
    getCurrentUser(),
  ]);
  const videoPlaylists = user
    ? playlists.filter((playlist) => playlist.ownerId === user.id && playlist.type === "videos")
    : [];

  return (
    <>
      <Header showBack={false} />
      <main className="p-8">
        <h1 className="text-[22px] font-semibold text-foreground mb-1">
          Browse performances
        </h1>
        <p className="text-[13.5px] text-muted-foreground mb-6">
          {performances.length} concerts, individually playable by song
        </p>

        <div
          className="grid gap-[22px]"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}
        >
          {performances.map((p) => (
            <PerformanceCard
              key={p.videoId}
              performance={p}
              playlists={videoPlaylists}
              isSignedIn={Boolean(user)}
            />
          ))}
        </div>
      </main>
    </>
  );
}
