import { AdventureExperience } from "@/components/adventure-experience";
import { Header } from "@/components/header";
import { getCurrentUser } from "@/lib/auth";
import {
  getPlaylistOptions,
  getPlaylists,
} from "@/lib/data";

export default async function AdventurePage() {
  const [options, playlists, user] = await Promise.all([
    getPlaylistOptions(),
    getPlaylists(),
    getCurrentUser(),
  ]);

  return (
    <>
      <Header user={user} />
      <AdventureExperience
        songOptions={options.songOptions}
        videoOptions={options.videoOptions}
        playlists={playlists}
        isSignedIn={Boolean(user)}
      />
    </>
  );
}
