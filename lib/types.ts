/**
 * Shared domain types for the app.
 *
 * `Song`/`Performance` mirror the pipeline's output contract documented in
 * tiny_office/PIPELINE.md (`reports/<id>.json`) — video_id, method,
 * clip_start/clip_end, confidence, suspect. Anything NOT in that contract
 * (ratings, reviews, playlists) is a new product surface with no backend
 * yet; those types exist so the UI has something to render, but the data
 * behind them is fixture/mock data until Supabase is wired in.
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
}

export interface Performance {
  /** YouTube video ID — same as reports/<video_id>.json */
  videoId: string;
  artist: string;
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
  /** mock — no ratings backend yet */
  avgRating: number | null;
  ratingCount: number;
  /** mock — no reviews backend yet */
  reviews: Review[];
}

export interface Review {
  user: string;
  rating: number;
  date: string;
  text: string;
}

export interface ReviewQueueItem {
  videoId: string;
  artist: string;
  confidencePct: number;
  whyText: string;
}

export interface PlaylistTrack {
  index: number;
  title: string;
  artist: string;
  /** e.g. "Tiny Desk · Mar 12, 2024" */
  performanceLabel: string;
  performanceVideoId: string;
  /** seconds */
  duration: number;
}

export interface Playlist {
  id: string;
  name: string;
  owner: string;
  tracks: PlaylistTrack[];
}
