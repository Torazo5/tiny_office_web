import type { Performance } from "@/lib/types";

/**
 * Real pipeline output, trimmed from tiny_office/reports/<video_id>.json
 * (candidates[].song/clip_start/clip_end/confidence/suspect, confidence.avg/min).
 * Chosen to span every confidence tier so the UI's state variants (verified
 * dot, "unconfirmed boundaries" sublabel, suspect flags, review queue) all
 * have a real example to render, not synthetic data.
 *
 * `avgRating` / `ratingCount` / `reviews` are NOT pipeline output. Runtime
 * reads come from Supabase now; these values remain as a small reference
 * fixture for development and tests.
 */
export const PERFORMANCES: Performance[] = [
  {
    videoId: "XfzpYcwiUrA",
    artist: "Adele",
    sourceTitle: "Adele: NPR Music Tiny Desk Concert",
    date: null,
    duration: 874,
    method: "comments",
    confidence: { avg: 97, min: 97 },
    verified: true,
    avgRating: 4.9,
    ratingCount: 3421,
    songs: [
      { index: 1, title: "Someone Like You", clipStart: 29.28, clipEnd: 332.64, confidence: 97, suspect: false },
      { index: 2, title: "Chasing Pavements", clipStart: 360.0, clipEnd: 584.16, confidence: 97, suspect: false },
      { index: 3, title: "Rolling In The Deep", clipStart: 612.96, clipEnd: 773.28, confidence: 97, suspect: false },
    ],
    reviews: [
      { user: "mfmiller", rating: 5, date: "placeholder", text: "One of the all-time Tiny Desk sets. “Someone Like You” live and unplugged is devastating." },
    ],
  },
  {
    videoId: "jIIuzB11dsA",
    artist: "Harry Styles",
    sourceTitle: "Harry Styles: NPR Music Tiny Desk Concert",
    date: null,
    duration: 1153,
    method: "comments",
    confidence: { avg: 91.5, min: 83 },
    verified: true,
    avgRating: 4.7,
    ratingCount: 2884,
    songs: [
      { index: 1, title: "Cherry", clipStart: 0, clipEnd: 203.04, confidence: 89, suspect: false },
      { index: 2, title: "Watermelon Sugar", clipStart: 304.8, clipEnd: 489.12, confidence: 83, suspect: false },
      { index: 3, title: "To Be So Lonely", clipStart: 636.96, clipEnd: 833.76, confidence: 97, suspect: false },
      { index: 4, title: "Adore You", clipStart: 913.44, clipEnd: 1127.04, confidence: 97, suspect: false },
    ],
    reviews: [],
  },
  {
    videoId: "FvVnP8G6ITs",
    artist: "Taylor Swift",
    sourceTitle: "Taylor Swift: NPR Music Tiny Desk Concert",
    date: null,
    duration: 1739,
    method: "comments",
    confidence: { avg: 89.5, min: 82 },
    verified: true,
    avgRating: 4.8,
    ratingCount: 5190,
    songs: [
      { index: 1, title: "The Man", clipStart: 152.16, clipEnd: 290.88, confidence: 97, suspect: false },
      { index: 2, title: "Lover", clipStart: 540.0, clipEnd: 764.16, confidence: 97, suspect: false },
      { index: 3, title: "Death By a Thousand Cuts", clipStart: 961.92, clipEnd: 1163.52, confidence: 82, suspect: false },
      { index: 4, title: "All Too Well", clipStart: 1377.12, clipEnd: 1710.72, confidence: 82, suspect: false },
    ],
    reviews: [],
  },
  {
    videoId: "ferZnZ0_rSM",
    artist: "Anderson .Paak & The Free Nationals",
    sourceTitle: "Anderson .Paak & The Free Nationals: NPR Music Tiny Desk Concert",
    date: null,
    duration: 938,
    method: "comments",
    confidence: { avg: 76, min: 76 },
    verified: true,
    avgRating: 4.6,
    ratingCount: 1802,
    songs: [
      { index: 1, title: "Come Down", clipStart: 8.16, clipEnd: 176.64, confidence: 76, suspect: false },
      { index: 2, title: "Heart Don't Stand A Chance", clipStart: 223.68, clipEnd: 404.64, confidence: 76, suspect: false },
      { index: 3, title: "Put Me Thru", clipStart: 454.56, clipEnd: 641.28, confidence: 76, suspect: false },
      { index: 4, title: "Suede", clipStart: 714.24, clipEnd: 907.68, confidence: 76, suspect: false },
    ],
    reviews: [
      { user: "soul_archive", rating: 5, date: "placeholder", text: "Anderson behind the kit for half of this is worth the watch alone." },
    ],
  },
  {
    videoId: "lkDYKk9k-2E",
    artist: "Tyler Childers",
    sourceTitle: "Tyler Childers: NPR Music Tiny Desk Concert",
    date: null,
    duration: 580,
    method: "comments",
    confidence: { avg: 73.3, min: 68 },
    verified: false,
    avgRating: 4.5,
    ratingCount: 640,
    songs: [
      { index: 1, title: "Nose On the Grindstone", clipStart: 11, clipEnd: 166.08, confidence: 68, suspect: false },
      { index: 2, title: "22nd Winter", clipStart: 205.92, clipEnd: 365.76, confidence: 76, suspect: false },
      { index: 3, title: "Lady May", clipStart: 386.4, clipEnd: 562.08, confidence: 76, suspect: false },
    ],
    reviews: [],
  },
  {
    videoId: "y38qQRg3UDI",
    artist: "Dua Lipa",
    sourceTitle: "Dua Lipa: Tiny Desk Concert",
    date: null,
    duration: 1105,
    method: "comments",
    confidence: { avg: 79.2, min: 68 },
    verified: false,
    avgRating: 4.4,
    ratingCount: 1290,
    songs: [
      { index: 1, title: "Training Season", clipStart: 3, clipEnd: 101.28, confidence: 68, suspect: false },
      { index: 2, title: "These Walls", clipStart: 302.4, clipEnd: 517.44, confidence: 83, suspect: false },
      { index: 3, title: "Happy For You", clipStart: 562.56, clipEnd: 795.36, confidence: 83, suspect: false },
      { index: 4, title: "Houdini", clipStart: 877.92, clipEnd: 1064.64, confidence: 83, suspect: false },
    ],
    reviews: [],
  },
  {
    videoId: "cMIJsoaxRjk",
    artist: "Justin Timberlake",
    sourceTitle: "Justin Timberlake: NPR Music Tiny Desk Concert",
    date: null,
    duration: 1540,
    method: "comments",
    confidence: { avg: 65.8, min: 32 },
    verified: false,
    avgRating: 4.1,
    ratingCount: 977,
    songs: [
      { index: 1, title: "Señorita", clipStart: 1, clipEnd: 142, confidence: 59, suspect: false },
      { index: 2, title: "Rock Your Body", clipStart: 142, clipEnd: 275.04, confidence: 67, suspect: false },
      { index: 3, title: "Pusher Love Girl", clipStart: 284.16, clipEnd: 444.0, confidence: 75, suspect: false },
      { index: 4, title: "Until The End Of Time", clipStart: 452.16, clipEnd: 632.16, confidence: 75, suspect: false },
      // Real pipeline artifact, left as-is on purpose: a spoken interlude
      // that got misread as a "song" candidate off a garbled comment-tier
      // timestamp label. suspect:true is exactly what should flag this for
      // a human to throw out in the review flow — don't "clean up" this row.
      { index: 5, title: "BREAK FOR SPEECH — 10:30 to", clipStart: 761.28, clipEnd: 766, confidence: 32, suspect: true },
      { index: 6, title: "Selfish", clipStart: 766, clipEnd: 996.96, confidence: 75, suspect: false },
      { index: 7, title: "What Goes Around... Comes Around", clipStart: 1000.32, clipEnd: 1168.32, confidence: 75, suspect: false },
      { index: 8, title: "SexyBack", clipStart: 1204.32, clipEnd: 1498.56, confidence: 68, suspect: false },
    ],
    reviews: [],
  },
  {
    videoId: "QrR_gm6RqCo",
    artist: "Mac Miller",
    sourceTitle: "Mac Miller: NPR Music Tiny Desk Concert",
    date: null,
    duration: 1029,
    method: "yamnet",
    confidence: { avg: 33.7, min: 0 },
    verified: false,
    avgRating: 4.8,
    ratingCount: 2011,
    songs: [
      { index: 1, title: "Small Worlds", clipStart: 0, clipEnd: 279.36, confidence: 58, suspect: false },
      { index: 2, title: "What's the Use? (Feat. Thundercat)", clipStart: 675.36, clipEnd: 995.52, confidence: 43, suspect: false },
      { index: 3, title: "2009", clipStart: 1014.24, clipEnd: 1029, confidence: 0, suspect: true },
    ],
    reviews: [],
  },
  {
    videoId: "e81LZCHhNKQ",
    artist: "Napalm Death",
    sourceTitle: "Napalm Death: NPR Music Tiny Desk Concert",
    date: null,
    duration: 1139,
    method: "yamnet",
    confidence: { avg: 27, min: 0 },
    verified: false,
    avgRating: 4.3,
    ratingCount: 188,
    songs: [
      { index: 1, title: "Instinct of Survival", clipStart: 10.56, clipEnd: 305.76, confidence: 66, suspect: false },
      { index: 2, title: "Strong-Arm", clipStart: 313.92, clipEnd: 485.76, confidence: 58, suspect: false },
      { index: 3, title: "Everyday Pox", clipStart: 501.6, clipEnd: 504.0, confidence: 16, suspect: true },
      { index: 4, title: "Throes of Joy in the Jaws of Defeatism", clipStart: 665.76, clipEnd: 856.32, confidence: 58, suspect: false },
      { index: 5, title: "Amoral", clipStart: 867.36, clipEnd: 870.24, confidence: 16, suspect: true },
      // clip_end < clip_start is real pipeline output (an inverted-range
      // case — see PIPELINE.md's "suspect flagging" section). Rendering
      // this as an unplayable/zero-length clip is correct; don't "fix"
      // the numbers here, fix the pipeline if this matters.
      { index: 6, title: "Dead", clipStart: 1068.96, clipEnd: 1060.32, confidence: 0, suspect: true },
      { index: 7, title: "Scum", clipStart: 1073.28, clipEnd: 1074.72, confidence: 1, suspect: true },
      { index: 8, title: "You Suffer", clipStart: 1085.28, clipEnd: 1087.2, confidence: 1, suspect: true },
    ],
    reviews: [],
  },
];
