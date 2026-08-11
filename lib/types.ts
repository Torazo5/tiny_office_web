/**
 * Shared domain types for the app.
 *
 * `Song`/`Performance` mirror the pipeline's output contract documented in
 * tiny_office/PIPELINE.md (`reports/<id>.json`) — video_id, method,
 * clip_start/clip_end, confidence, suspect. Anything NOT in that contract
 * (ratings, reviews, playlists) are product surfaces backed by Supabase.
 */

export type ConfidenceTier = "high" | "medium" | "low" | "very-low";

/** matches confidence_label() in scripts/confidence.py */
export function confidenceTier(min: number): ConfidenceTier {
  if (min >= 75) return "high";
  if (min >= 50) return "medium";
  if (min >= 30) return "low";
  return "very-low";
}

export interface Song {
  index: number;
  title: string;
  /** seconds, from candidates[].clip_start */
  clipStart: number;
  /** seconds, from candidates[].clip_end */
  clipEnd: number;
  /** 0-100, from candidates[].confidence */
  confidence: number;
  /** from candidates[].suspect */
  suspect: boolean;
  /** Public aggregate count of hearts for this song. */
  heartCount?: number;
  /** Whether the current signed-in listener has hearted this song. */
  hearted?: boolean;
}

export interface RatingDistributionEntry {
  rating: number;
  count: number;
}

export type PlaylistSongClip = Pick<Song, "clipStart" | "clipEnd">;

export interface Performance {
  /** YouTube video ID — same as reports/<video_id>.json */
  videoId: string;
  artist: string;
  /** Original YouTube title captured by the pipeline and stored in Supabase. */
  sourceTitle: string;
  /**
   * ISO date string, or null. The pipeline's yt-dlp call never captured
   * upload_date (see PIPELINE.md's JSON schema — it's not a field), so
   * real dates aren't available yet. Don't invent one; Codex should pull
   * this from a real metadata source when the backend is wired in.
   */
  date: string | null;
  /** seconds, from duration */
  duration: number;
  method: "comments" | "yamnet" | "silence" | "transcript" | "manual";
  songs: Song[];
  /** video-level confidence, from confidence.avg / confidence.min */
  confidence: { avg: number; min: number };
  /** min >= 75 — safe to trust without a review.py pass, per PIPELINE.md */
  verified: boolean;
  /** Aggregated from the ratings table. */
  avgRating: number | null;
  ratingCount: number;
  /** Counts for each half-star rating, highest score first, when loaded. */
  ratingDistribution?: RatingDistributionEntry[];
  /** Public reviews with like state for the current session. */
  reviews: Review[];
}

export type PerformanceCutKey = "no-audience" | "with-audience";

export interface PerformanceCutVariant {
  key: PerformanceCutKey;
  name: string;
  description: string;
  songs: ListeningPresetSong[];
}

export interface Review {
  id?: string;
  user: string;
  avatarUrl?: string;
  rating: number;
  date: string;
  text: string;
  likeCount?: number;
  likedByCurrentUser?: boolean;
}

export interface UserReview {
  id: string;
  performanceVideoId: string;
  artist: string;
  performanceDate: string | null;
  rating: number;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewQueueItem {
  videoId: string;
  artist: string;
  confidencePct: number;
  whyText: string;
}

export interface TimelineDraftSong {
  songIndex: number;
  title: string;
  clipStart: number;
  clipEnd: number;
  /** Admin decision about whether this boundary is safe to treat as confirmed. */
  confirmed: boolean;
}

export type TruthRequestStatus = "pending" | "approved" | "rejected";

export interface ListeningPresetSong {
  songIndex: number;
  title: string;
  clipStart: number;
  clipEnd: number;
}

export interface ListeningPreset {
  id: string;
  performanceVideoId: string;
  variantKey: PerformanceCutKey;
  ownerId: string;
  ownerName: string;
  name: string;
  note: string | null;
  status: "published" | "hidden";
  createdAt: string;
  songs: ListeningPresetSong[];
}

export interface TruthRequestSummary {
  id: string;
  performanceVideoId: string;
  variantKey: PerformanceCutKey;
  artist: string;
  requesterId: string;
  requesterName: string;
  note: string | null;
  status: TruthRequestStatus;
  createdAt: string;
  resolvedAt: string | null;
}

export type PlaylistType = "songs" | "videos";

export interface PlaylistTrack {
  /** Display position in the playlist. */
  index: number;
  /** Persisted position used when removing this track. */
  position: number;
  title: string;
  artist: string;
  /** e.g. "Tiny Desk · Mar 12, 2024" */
  performanceLabel: string;
  performanceVideoId: string;
  songIndex: number | null;
  clipStart: number;
  clipEnd: number;
  /** seconds */
  duration: number;
  heartCount?: number;
  /** Song boundaries used to skip gaps during full-performance playback. */
  songClips: PlaylistSongClip[];
}

export interface Playlist {
  id: string;
  name: string;
  owner: string;
  type: PlaylistType;
  ownerId?: string | null;
  tracks: PlaylistTrack[];
}

export interface PlaylistSummary {
  id: string;
  name: string;
  owner: string;
  type: PlaylistType;
  ownerId: string | null;
  trackCount: number;
  thumbnailVideoId: string | null;
}

export interface PlaylistSongOption {
  performanceVideoId: string;
  songIndex: number;
  title: string;
  artist: string;
  performanceLabel: string;
  clipStart: number;
  clipEnd: number;
  duration: number;
  heartCount?: number;
}

export interface PlaylistVideoOption {
  performanceVideoId: string;
  title: string;
  artist: string;
  performanceLabel: string;
  duration: number;
  songClips: PlaylistSongClip[];
}
