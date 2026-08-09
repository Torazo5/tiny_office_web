import { AdventureExperience } from "@/components/adventure-experience";
import { Header } from "@/components/header";
import { getCurrentUser } from "@/lib/auth";
import {
  getPlaylistSongOptions,
  getPlaylistVideoOptions,
  getPlaylists,
} from "@/lib/data";

export default async function AdventurePage() {
  const [songOptions, videoOptions, playlists, user] = await Promise.all([
    getPlaylistSongOptions(),
    getPlaylistVideoOptions(),
    getPlaylists(),
    getCurrentUser(),
  ]);

  return (
    <>
      <Header />
      <AdventureExperience
        songOptions={songOptions}
        videoOptions={videoOptions}
        playlists={playlists}
        isSignedIn={Boolean(user)}
      />
    </>
  );
}
