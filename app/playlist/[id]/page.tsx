import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { PlaylistDetail } from "@/components/playlist-detail";
import { getCurrentUser } from "@/lib/auth";
import { getPlaylist, getPlaylistSongOptions } from "@/lib/data";

/**
 * Playlist metadata and track membership come from Supabase. The interactive
 * add/remove controls live in a small client component so the page can keep
 * the catalog query and authorization decision on the server.
 */
export default async function PlaylistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const playlist = await getPlaylist(id);
  if (!playlist) notFound();

  const [catalog, user] = await Promise.all([getPlaylistSongOptions(), getCurrentUser()]);
  const canManage = Boolean(user && playlist.ownerId === user.id);

  return (
    <>
      <Header />
      <PlaylistDetail
        playlist={playlist}
        catalog={catalog}
        canManage={canManage}
        isSignedIn={Boolean(user)}
      />
    </>
  );
}
