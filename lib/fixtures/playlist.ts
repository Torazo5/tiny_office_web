import type { Playlist } from "@/lib/types";

/**
 * A playlist is a pure product-layer concept — the pipeline has no notion
 * of one. This is entirely mock data (one hardcoded playlist, returned
 * regardless of the requested id) standing in for a real playlists table.
 * Track durations/labels are pulled from real fixture songs in
 * lib/fixtures/performances.ts so at least the underlying song data is real.
 */
export const DEMO_PLAYLIST: Playlist = {
  id: "late-night-sets",
  name: "Late Night Sets",
  owner: "You",
  tracks: [
    { index: 1, title: "Someone Like You", artist: "Adele", performanceLabel: "Tiny Desk Concert", performanceVideoId: "XfzpYcwiUrA", duration: 303 },
    { index: 2, title: "Cherry", artist: "Harry Styles", performanceLabel: "Tiny Desk Concert", performanceVideoId: "jIIuzB11dsA", duration: 203 },
    { index: 3, title: "The Man", artist: "Taylor Swift", performanceLabel: "Tiny Desk Concert", performanceVideoId: "FvVnP8G6ITs", duration: 139 },
    { index: 4, title: "Come Down", artist: "Anderson .Paak & The Free Nationals", performanceLabel: "Tiny Desk Concert", performanceVideoId: "ferZnZ0_rSM", duration: 168 },
    { index: 5, title: "Lady May", artist: "Tyler Childers", performanceLabel: "Tiny Desk Concert", performanceVideoId: "lkDYKk9k-2E", duration: 176 },
    { index: 6, title: "Houdini", artist: "Dua Lipa", performanceLabel: "Tiny Desk Concert", performanceVideoId: "y38qQRg3UDI", duration: 187 },
    { index: 7, title: "Selfish", artist: "Justin Timberlake", performanceLabel: "Tiny Desk Concert", performanceVideoId: "cMIJsoaxRjk", duration: 231 },
  ],
};
