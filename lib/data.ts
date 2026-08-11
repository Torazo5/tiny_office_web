import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";
import { getCurrentUser } from "@/lib/auth";
import { formatProfileLabel, getIdenticonUrl, getProfilesByUserId } from "@/lib/profile-data";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import type {
  Performance,
  Playlist,
  PlaylistSongOption,
  PlaylistSummary,
  PlaylistType,
  PlaylistVideoOption,
  PlaylistTrack,
  ReviewQueueItem,
  Song,
  PlaylistSongClip,
} from "@/lib/types";

type PerformanceRow = {
  video_id: string;
  artist: string;
  source_title: string;
  date: string | null;
  duration: number;
  method: Performance["method"];
  confidence_avg: number;
  confidence_min: number;
  verified: boolean;
};

type SongRow = {
  performance_video_id: string;
  song_index: number;
  title: string;
  clip_start: number;
  clip_end: number;
  confidence: number;
  suspect: boolean;
  overlap_detected: boolean;
  fade_out_start: number | null;
  fade_out_end: number | null;
  heart_count?: number;
};

type BrowseRatingRow = {
  performance_video_id: string;
  rating: number;
};

type ReviewRow = {
  id: string;
  performance_video_id: string;
  user_id: string;
  rating: number;
  text: string;
  created_at: string;
};

export const PUBLIC_CATALOG_CACHE_TAG = "public-catalog";
const PUBLIC_CATALOG_REVALIDATE_SECONDS = 300;

function throwIfError(label: string, error: { message: string } | null) {
  if (error) throw new Error(`${label}: ${error.message}`);
}
function mapSong(song: SongRow): Song {
  return {
    index: song.song_index,
    title: song.title,
    clipStart: Number(song.clip_start),
    clipEnd: Number(song.clip_end),
    confidence: song.confidence,
    suspect: song.suspect,
    overlapDetected: Boolean(song.overlap_detected),
    fadeOutStart: song.fade_out_start === null ? null : Number(song.fade_out_start),
    fadeOutEnd: song.fade_out_end === null ? null : Number(song.fade_out_end),
    heartCount: Number(song.heart_count ?? 0),
  };
}

function mapPerformance(
  performance: PerformanceRow,
  songRows: SongRow[],
  avgRating: number | null = null,
  ratingCount = 0,
  ratingDistribution: Performance["ratingDistribution"] = [],
  reviews: Performance["reviews"] = [],
): Performance {
  return {
    videoId: performance.video_id,
    artist: performance.artist,
    sourceTitle: performance.source_title,
    date: performance.date,
    duration: Number(performance.duration),
    method: performance.method,
    songs: songRows.map(mapSong),
    confidence: { avg: Number(performance.confidence_avg), min: Number(performance.confidence_min) },
    verified: performance.verified,
    avgRating,
    ratingCount,
    ratingDistribution,
    reviews,
  } satisfies Performance;
}

function ratingDistribution(ratings: number[]): Performance["ratingDistribution"] {
  return Array.from({ length: 10 }, (_, index) => {
    const rating = 5 - index * 0.5;
    return { rating, count: ratings.filter((value) => value === rating).length };
  });
}

function ratingsByPerformance(rows: BrowseRatingRow[]) {
  const ratings = new Map<string, number[]>();
  for (const row of rows) {
    const values = ratings.get(row.performance_video_id) ?? [];
    values.push(Number(row.rating));
    ratings.set(row.performance_video_id, values);
  }
  return ratings;
}

async function loadBrowsePerformances(): Promise<Performance[]> {
  const supabase = createPublicClient();
  const [performancesResult, songsResult, ratingsResult] = await Promise.all([
    supabase
      .from("performances")
      .select("video_id, artist, source_title, date, duration, method, confidence_avg, confidence_min, verified")
      .neq("method", "manual")
      .order("artist"),
    supabase
      .from("songs")
      .select("performance_video_id, song_index, title, clip_start, clip_end, confidence, suspect, overlap_detected, fade_out_start, fade_out_end, heart_count")
      .order("performance_video_id")
      .order("song_index"),
    supabase.from("ratings").select("performance_video_id, rating"),
  ]);

  throwIfError("Loading performances", performancesResult.error);
  throwIfError("Loading songs", songsResult.error);
  throwIfError("Loading ratings", ratingsResult.error);

  const songsByPerformance = new Map<string, SongRow[]>();
  for (const song of (songsResult.data ?? []) as SongRow[]) {
    const songs = songsByPerformance.get(song.performance_video_id) ?? [];
    songs.push(song);
    songsByPerformance.set(song.performance_video_id, songs);
  }

  const ratings = ratingsByPerformance((ratingsResult.data ?? []) as BrowseRatingRow[]);
  return ((performancesResult.data ?? []) as PerformanceRow[]).map((row) => {
    const values = ratings.get(row.video_id) ?? [];
    return mapPerformance(
      row,
      songsByPerformance.get(row.video_id) ?? [],
      values.length ? values.reduce((total, rating) => total + rating, 0) / values.length : null,
      values.length,
      ratingDistribution(values),
    );
  });
}

export const INITIAL_CATALOG_BATCH_SIZE = 12;

export type BrowsePerformancePage = {
  performances: Performance[];
  hasMore: boolean;
  nextOffset: number;
};

/**
 * The home page deliberately loads a small, quality-first slice. Full catalog
 * reads still power search and the other authenticated product surfaces.
 */
export async function getBrowsePerformancePage(
  offset = 0,
  limit = INITIAL_CATALOG_BATCH_SIZE,
): Promise<BrowsePerformancePage> {
  const safeOffset = Math.max(0, Math.floor(offset));
  const safeLimit = Math.min(24, Math.max(1, Math.floor(limit)));
  const supabase = createPublicClient();
  const performancesResult = await supabase
    .from("performances")
    .select("video_id, artist, source_title, date, duration, method, confidence_avg, confidence_min, verified", { count: "exact" })
    .neq("method", "manual")
    .order("verified", { ascending: false })
    .order("confidence_avg", { ascending: false })
    .order("artist")
    .range(safeOffset, safeOffset + safeLimit - 1);
  throwIfError("Loading catalog page", performancesResult.error);

  const rows = (performancesResult.data ?? []) as PerformanceRow[];
  const videoIds = rows.map((row) => row.video_id);
  if (videoIds.length === 0) {
    return { performances: [], hasMore: false, nextOffset: safeOffset };
  }

  const [songsResult, ratingsResult] = await Promise.all([
    supabase
      .from("songs")
      .select("performance_video_id, song_index, title, clip_start, clip_end, confidence, suspect, overlap_detected, fade_out_start, fade_out_end, heart_count")
      .in("performance_video_id", videoIds)
      .order("performance_video_id")
      .order("song_index"),
    supabase.from("ratings").select("performance_video_id, rating").in("performance_video_id", videoIds),
  ]);
  throwIfError("Loading catalog songs", songsResult.error);
  throwIfError("Loading catalog ratings", ratingsResult.error);

  const songsByPerformance = new Map<string, SongRow[]>();
  for (const song of (songsResult.data ?? []) as SongRow[]) {
    const songs = songsByPerformance.get(song.performance_video_id) ?? [];
    songs.push(song);
    songsByPerformance.set(song.performance_video_id, songs);
  }
  const ratings = ratingsByPerformance((ratingsResult.data ?? []) as BrowseRatingRow[]);
  const performances = rows.map((row) => {
    const values = ratings.get(row.video_id) ?? [];
    return mapPerformance(
      row,
      songsByPerformance.get(row.video_id) ?? [],
      values.length ? values.reduce((total, rating) => total + rating, 0) / values.length : null,
      values.length,
      ratingDistribution(values),
    );
  });
  const nextOffset = safeOffset + rows.length;
  return {
    performances,
    hasMore: nextOffset < (performancesResult.count ?? nextOffset),
    nextOffset,
  };
}

const getCachedBrowsePerformances = unstable_cache(
  loadBrowsePerformances,
  ["public-browse-performances"],
  {
    tags: [PUBLIC_CATALOG_CACHE_TAG],
    revalidate: PUBLIC_CATALOG_REVALIDATE_SECONDS,
  },
);

const loadPerformances = cache(async () => getCachedBrowsePerformances());

async function loadPerformance(videoId: string): Promise<Performance | null> {
  const supabase = createPublicClient();
  const [performanceResult, songsResult] = await Promise.all([
    supabase
      .from("performances")
      .select("video_id, artist, source_title, date, duration, method, confidence_avg, confidence_min, verified")
      .eq("video_id", videoId)
      .neq("method", "manual")
      .maybeSingle(),
    supabase
      .from("songs")
      .select("performance_video_id, song_index, title, clip_start, clip_end, confidence, suspect, overlap_detected, fade_out_start, fade_out_end, heart_count")
      .eq("performance_video_id", videoId)
      .order("song_index"),
  ]);

  throwIfError("Loading performance", performanceResult.error);
  throwIfError("Loading performance songs", songsResult.error);
  if (!performanceResult.data) return null;

  return mapPerformance(
    performanceResult.data as PerformanceRow,
    (songsResult.data ?? []) as SongRow[],
  );
}

const getCachedPerformance = cache(async (videoId: string) => {
  const load = unstable_cache(
    async () => loadPerformance(videoId),
    ["public-performance", videoId],
    {
      tags: [PUBLIC_CATALOG_CACHE_TAG, `public-performance:${videoId}`],
      revalidate: PUBLIC_CATALOG_REVALIDATE_SECONDS,
    },
  );
  return load();
});

async function loadPerformanceDetail(videoId: string, currentUserId: string | null) {
  const performance = await getCachedPerformance(videoId);
  if (!performance) return null;

  const supabase = createPublicClient();
  const [ratingsResult, reviewsResult] = await Promise.all([
    supabase.from("ratings").select("rating").eq("performance_video_id", videoId),
    supabase
      .from("reviews")
      .select("id, performance_video_id, user_id, rating, text, created_at")
      .eq("performance_video_id", videoId)
      .order("created_at", { ascending: false }),
  ]);

  throwIfError("Loading performance ratings", ratingsResult.error);
  throwIfError("Loading performance reviews", reviewsResult.error);

  const reviews = (reviewsResult.data ?? []) as ReviewRow[];
  const reviewIds = reviews.map((review) => review.id);
  const [likesResult, reviewProfiles] = await Promise.all([
    reviewIds.length
      ? supabase.from("review_likes").select("review_id, user_id").in("review_id", reviewIds)
      : Promise.resolve({ data: [], error: null }),
    getProfilesByUserId(reviews.map((review) => review.user_id)),
  ]);
  throwIfError("Loading performance review likes", likesResult.error);
  const likesByReview = new Map<string, { count: number; liked: boolean }>();
  for (const like of likesResult.data ?? []) {
    const current = likesByReview.get(like.review_id) ?? { count: 0, liked: false };
    current.count += 1;
    current.liked ||= like.user_id === currentUserId;
    likesByReview.set(like.review_id, current);
  }

  const mappedReviews = reviews.map((review) => {
    const likes = likesByReview.get(review.id) ?? { count: 0, liked: false };
    return {
      id: review.id,
      user: formatProfileLabel(reviewProfiles.get(review.user_id)),
      avatarUrl: getIdenticonUrl(review.user_id),
      rating: Number(review.rating),
      date: review.created_at,
      text: review.text,
      likeCount: likes.count,
      likedByCurrentUser: likes.liked,
    };
  });
  const ratings = (ratingsResult.data ?? []).map((rating) => Number(rating.rating));

  return {
    ...performance,
    avgRating: ratings.length
      ? ratings.reduce((total, rating) => total + rating, 0) / ratings.length
      : null,
    ratingCount: ratings.length,
    ratingDistribution: ratingDistribution(ratings),
    reviews: mappedReviews,
  } satisfies Performance;
}

/**
 * All performance reads use the approved values in public.songs. User drafts,
 * truth requests, and listening presets are separate overlays and never
 * silently become public ground truth.
 */

export async function getPerformances(): Promise<Performance[]> {
  return loadPerformances();
}

export async function getPerformance(videoId: string): Promise<Performance | null> {
  return getCachedPerformance(videoId);
}

export async function getPerformanceDetail(
  videoId: string,
  currentUserId: string | null = null,
): Promise<Performance | null> {
  return loadPerformanceDetail(videoId, currentUserId);
}

/**
 * Videos below the trust threshold (confidence.min < 75, see PIPELINE.md's
 * "for building the app" section) need a human pass before their song
 * boundaries are shown as fact. This is that worklist.
 *
 * Note: pipeline `method === "manual"` videos (zero candidates — e.g. The
 * Roots feat. Bilal in the real dataset) are excluded here on purpose. The
 * review flow UI below assumes existing clip_start/clip_end candidates to
 * nudge; a manual-tier video needs a different free-scrub flow (the
 * scripts/manual_mark.py equivalent) that doesn't exist in this app yet.
 */
export async function getReviewQueue(): Promise<ReviewQueueItem[]> {
  const performances = await loadPerformances();
  return performances.filter((p) => !p.verified).map((p) => {
    const suspectCount = p.songs.filter((s) => s.suspect).length;
    const whyText =
      suspectCount > 0
        ? `${suspectCount} of ${p.songs.length} song boundaries flagged suspect`
        : `Lowest-confidence song at ${p.confidence.min}%`;
    return {
      videoId: p.videoId,
      artist: p.artist,
      confidencePct: Math.round(p.confidence.avg),
      whyText,
    };
  });
}

export async function getPlaylists(ownerId?: string | null): Promise<PlaylistSummary[]> {
  let currentOwnerId = ownerId;
  if (currentOwnerId === undefined) {
    currentOwnerId = (await getCurrentUser())?.id ?? null;
  }
  if (!currentOwnerId) return [];

  const supabase = await createClient();

  const playlistsResult = await supabase
    .from("playlists")
    .select("id, name, owner_name, owner_id, playlist_type")
    .eq("owner_id", currentOwnerId)
    .order("updated_at", { ascending: false });

  throwIfError("Loading playlists", playlistsResult.error);

  if (!playlistsResult.data?.length) return [];

  const tracksResult = await supabase
    .from("playlist_tracks")
    .select("playlist_id, performance_video_id, position")
    .in("playlist_id", playlistsResult.data.map((playlist) => playlist.id))
    .order("position");

  throwIfError("Loading playlist track counts", tracksResult.error);

  const playlistProfiles = await getProfilesByUserId(
    (playlistsResult.data ?? [])
      .map((playlist) => playlist.owner_id)
      .filter((ownerId): ownerId is string => Boolean(ownerId)),
  );

  const trackCounts = new Map<string, number>();
  const thumbnailVideoIds = new Map<string, string>();
  for (const track of tracksResult.data ?? []) {
    trackCounts.set(track.playlist_id, (trackCounts.get(track.playlist_id) ?? 0) + 1);
    if (!thumbnailVideoIds.has(track.playlist_id)) {
      thumbnailVideoIds.set(track.playlist_id, track.performance_video_id);
    }
  }

  return (playlistsResult.data ?? []).map((playlist) => ({
    id: playlist.id,
    name: playlist.name,
    owner: playlist.owner_id
      ? formatProfileLabel(playlistProfiles.get(playlist.owner_id))
      : playlist.owner_name,
    type: playlist.playlist_type as PlaylistType,
    ownerId: playlist.owner_id,
    trackCount: trackCounts.get(playlist.id) ?? 0,
    thumbnailVideoId: thumbnailVideoIds.get(playlist.id) ?? null,
  }));
}

export async function getPlaylist(id: string, ownerId?: string | null): Promise<Playlist | null> {
  let currentOwnerId = ownerId;
  if (currentOwnerId === undefined) {
    currentOwnerId = (await getCurrentUser())?.id ?? null;
  }
  if (!currentOwnerId) return null;

  const supabase = await createClient();

  const { data: playlist, error: playlistError } = await supabase
    .from("playlists")
    .select("id, name, owner_name, owner_id, playlist_type")
    .eq("id", id)
    .eq("owner_id", currentOwnerId)
    .maybeSingle();
  throwIfError("Loading playlist", playlistError);
  if (!playlist) return null;

  const ownerProfile = playlist.owner_id
    ? (await getProfilesByUserId([playlist.owner_id])).get(playlist.owner_id)
    : undefined;
  const owner = playlist.owner_id ? formatProfileLabel(ownerProfile) : playlist.owner_name;

  const { data: tracks, error: tracksError } = await supabase
    .from("playlist_tracks")
    .select("position, performance_video_id, song_index")
    .eq("playlist_id", id)
    .order("position");
  throwIfError("Loading playlist tracks", tracksError);

  const videoIds = [...new Set((tracks ?? []).map((track) => track.performance_video_id))];
  if (videoIds.length === 0) {
    return {
      id: playlist.id,
      name: playlist.name,
      owner,
      type: playlist.playlist_type as PlaylistType,
      ownerId: playlist.owner_id,
      tracks: [],
    };
  }

  const { data: performanceRows, error: performancesError } = await supabase
    .from("performances")
    .select("video_id, artist, source_title, date, duration")
    .in("video_id", videoIds);
  throwIfError("Loading playlist performances", performancesError);

  const { data: songRows, error: songsError } = await supabase
    .from("songs")
    .select("performance_video_id, song_index, title, clip_start, clip_end, overlap_detected, fade_out_start, fade_out_end")
    .in("performance_video_id", videoIds)
    .order("performance_video_id")
    .order("song_index");
  throwIfError("Loading playlist songs", songsError);

  const performances = new Map((performanceRows ?? []).map((performance) => [performance.video_id, performance]));
  const songs = new Map(
    (songRows ?? []).map((song) => [`${song.performance_video_id}:${song.song_index}`, song]),
  );
  const songClipsByPerformance = new Map<string, PlaylistSongClip[]>();
  for (const song of songRows ?? []) {
    const songClips = songClipsByPerformance.get(song.performance_video_id) ?? [];
    songClips.push({
      clipStart: Number(song.clip_start),
      clipEnd: Number(song.clip_end),
      overlapDetected: Boolean(song.overlap_detected),
      fadeOutStart: song.fade_out_start === null ? null : Number(song.fade_out_start),
      fadeOutEnd: song.fade_out_end === null ? null : Number(song.fade_out_end),
    });
    songClipsByPerformance.set(song.performance_video_id, songClips);
  }

  let displayIndex = 0;

  return {
    id: playlist.id,
    name: playlist.name,
    owner,
    type: playlist.playlist_type as PlaylistType,
    ownerId: playlist.owner_id,
    tracks: (tracks ?? []).flatMap((track): PlaylistTrack[] => {
      const performance = performances.get(track.performance_video_id);
      const song = songs.get(`${track.performance_video_id}:${track.song_index}`);
      if (!performance) return [];

      if (playlist.playlist_type === "videos") {
        displayIndex += 1;
        const duration = Math.max(0, Number(performance.duration));
        const songClips = songClipsByPerformance.get(performance.video_id) ?? [];
        const firstPlayableSong = songClips.find((clip) => clip.clipEnd > clip.clipStart);
        return [{
          index: displayIndex,
          position: track.position,
          title: performance.artist,
          artist: performance.artist,
          performanceLabel: performance.source_title,
          performanceVideoId: performance.video_id,
          songIndex: null,
          clipStart: firstPlayableSong?.clipStart ?? 0,
          clipEnd: duration,
          duration,
          overlapDetected: Boolean(false),
          fadeOutStart: null,
          fadeOutEnd: null,
          songClips,
        }];
      }

      if (!song) return [];
      displayIndex += 1;
      return [{
        index: displayIndex,
        position: track.position,
        title: song.title,
        artist: performance.artist,
        performanceLabel: performance.source_title,
        performanceVideoId: performance.video_id,
        songIndex: song.song_index,
        clipStart: Number(song.clip_start),
        clipEnd: Number(song.clip_end),
        duration: Math.max(0, Number(song.clip_end) - Number(song.clip_start)),
        overlapDetected: Boolean(song.overlap_detected),
        fadeOutStart: song.fade_out_start === null ? null : Number(song.fade_out_start),
        fadeOutEnd: song.fade_out_end === null ? null : Number(song.fade_out_end),
        songClips: [],
      }];
    }),
  };
}

const loadPlaylistOptions = cache(async () => {
  const performances = await loadPerformances();
  const songOptions: PlaylistSongOption[] = performances.flatMap((performance) =>
    performance.songs.map((song) => ({
      performanceVideoId: performance.videoId,
      songIndex: song.index,
      title: song.title,
      artist: performance.artist,
      performanceLabel: performance.sourceTitle,
      clipStart: song.clipStart,
      clipEnd: song.clipEnd,
      duration: Math.max(0, song.clipEnd - song.clipStart),
      heartCount: song.heartCount,
      overlapDetected: song.overlapDetected,
      fadeOutStart: song.fadeOutStart,
      fadeOutEnd: song.fadeOutEnd,
    })),
  );
  const videoOptions: PlaylistVideoOption[] = performances.map((performance) => ({
    performanceVideoId: performance.videoId,
    title: performance.artist,
    artist: performance.artist,
    performanceLabel: performance.sourceTitle,
    duration: performance.duration,
    songClips: performance.songs.map(({ clipStart, clipEnd, overlapDetected, fadeOutStart, fadeOutEnd }) => ({
      clipStart,
      clipEnd,
      overlapDetected,
      fadeOutStart,
      fadeOutEnd,
    })),
  }));

  return { songOptions, videoOptions };
});

export async function getPlaylistOptions() {
  return loadPlaylistOptions();
}

export async function getPlaylistSongOptions(): Promise<PlaylistSongOption[]> {
  return (await loadPlaylistOptions()).songOptions;
}

export async function getPlaylistVideoOptions(): Promise<PlaylistVideoOption[]> {
  return (await loadPlaylistOptions()).videoOptions;
}
