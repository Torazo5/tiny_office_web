import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { PlaylistDetail } from "@/components/playlist-detail";
import { PlaylistSignInGate } from "@/components/playlist-sign-in-gate";
import { getCurrentUser } from "@/lib/auth";
import { getPlaylist, getPlaylistSongOptions, getPlaylistVideoOptions } from "@/lib/data";

/**
 * Playlist metadata and track membership come from Supabase. The persistent
 * YouTube player and interactive add/remove controls live in a small client
 * component so the catalog query and authorization decision stay on the server.
 */
export default async function PlaylistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return (
      <>
        <Header />
        <main className="p-8">
          <PlaylistSignInGate nextPath={`/playlist/${id}`} />
        </main>
      </>
    );
  }

  const playlist = await getPlaylist(id, user.id);
  if (!playlist) notFound();

  const [songCatalog, videoCatalog] = await Promise.all([
    getPlaylistSongOptions(),
    getPlaylistVideoOptions(),
  ]);
  const canManage = playlist.ownerId === user.id;

  return (
    <>
      <Header />
      <PlaylistDetail
        playlist={playlist}
        songCatalog={songCatalog}
        videoCatalog={videoCatalog}
        canManage={canManage}
        isSignedIn
      />
    </>
  );
}
