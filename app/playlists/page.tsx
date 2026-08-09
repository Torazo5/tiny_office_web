import { Header } from "@/components/header";
import { PlaylistLibrary } from "@/components/playlist-library";
import { getCurrentUser } from "@/lib/auth";
import { getPlaylists } from "@/lib/data";

export default async function PlaylistsPage() {
  const user = await getCurrentUser();
  const playlists = await getPlaylists(user?.id ?? null);

  return (
    <>
      <Header showBack={true} user={user} />
      <main className="p-8">
        <PlaylistLibrary playlists={playlists} userId={user?.id ?? null} />
      </main>
    </>
  );
}
