import { AdventureExperience } from "@/components/adventure-experience";
import { Header } from "@/components/header";
import { getCurrentUser } from "@/lib/auth";
import {
  getPlaylistOptions,
  getPlaylists,
} from "@/lib/data";
import { getPlaybackDefaults } from "@/lib/profile-data";
import { DEFAULT_PLAYBACK_SETTINGS } from "@/lib/playback-settings";

export default async function AdventurePage() {
  const user = await getCurrentUser();
  const [options, playlists, playbackDefaults] = await Promise.all([
    getPlaylistOptions(),
    getPlaylists(user?.id),
    user ? getPlaybackDefaults(user.id) : Promise.resolve(DEFAULT_PLAYBACK_SETTINGS),
  ]);

  return (
    <>
      <Header user={user} />
      <AdventureExperience
        songOptions={options.songOptions}
        videoOptions={options.videoOptions}
        playlists={playlists}
        isSignedIn={Boolean(user)}
        initialPlaybackSettings={playbackDefaults}
      />
    </>
  );
}
