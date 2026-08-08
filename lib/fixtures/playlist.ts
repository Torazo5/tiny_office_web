import type { Playlist } from "@/lib/types";

/**
 * Legacy demo data for tests or local prototypes. Production playlist pages
 * now read from the Supabase playlists and playlist_tracks tables.
 */
export const DEMO_PLAYLIST: Playlist = {
  id: "late-night-sets",
  name: "Late Night Sets",
  owner: "You",
  type: "songs",
  tracks: [
    { index: 1, position: 1, title: "Someone Like You", artist: "Adele", performanceLabel: "Tiny Desk Concert", performanceVideoId: "XfzpYcwiUrA", songIndex: 1, clipStart: 0, clipEnd: 303, duration: 303 },
    { index: 2, position: 2, title: "Cherry", artist: "Harry Styles", performanceLabel: "Tiny Desk Concert", performanceVideoId: "jIIuzB11dsA", songIndex: 1, clipStart: 0, clipEnd: 203, duration: 203 },
    { index: 3, position: 3, title: "The Man", artist: "Taylor Swift", performanceLabel: "Tiny Desk Concert", performanceVideoId: "FvVnP8G6ITs", songIndex: 1, clipStart: 0, clipEnd: 139, duration: 139 },
    { index: 4, position: 4, title: "Come Down", artist: "Anderson .Paak & The Free Nationals", performanceLabel: "Tiny Desk Concert", performanceVideoId: "ferZnZ0_rSM", songIndex: 1, clipStart: 0, clipEnd: 168, duration: 168 },
    { index: 5, position: 5, title: "Lady May", artist: "Tyler Childers", performanceLabel: "Tiny Desk Concert", performanceVideoId: "lkDYKk9k-2E", songIndex: 3, clipStart: 0, clipEnd: 176, duration: 176 },
    { index: 6, position: 6, title: "Houdini", artist: "Dua Lipa", performanceLabel: "Tiny Desk Concert", performanceVideoId: "y38qQRg3UDI", songIndex: 4, clipStart: 0, clipEnd: 187, duration: 187 },
    { index: 7, position: 7, title: "Selfish", artist: "Justin Timberlake", performanceLabel: "Tiny Desk Concert", performanceVideoId: "cMIJsoaxRjk", songIndex: 6, clipStart: 0, clipEnd: 231, duration: 231 },
  ],
};
