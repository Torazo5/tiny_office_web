import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  Performance,
  Playlist,
  PlaylistSongOption,
  PlaylistSummary,
  PlaylistType,
  PlaylistVideoOption,
  ReviewQueueItem,
  Song,
  PlaylistSongClip,
} from "@/lib/types";

type PerformanceRow = {
  video_id: string;
  artist: string;
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
};

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
  };
}

async function loadPerformances(): Promise<Performance[]> {
  const supabase = await createClient();
  const [performancesResult, songsResult, ratingsResult, reviewsResult, likesResult, authResult] = await Promise.all([
    supabase
      .from("performances")
      .select("video_id, artist, date, duration, method, confidence_avg, confidence_min, verified")
      .neq("method", "manual")
      .order("artist"),
    supabase
      .from("songs")
      .select("performance_video_id, song_index, title, clip_start, clip_end, confidence, suspect")
      .order("performance_video_id")
      .order("song_index"),
    supabase.from("ratings").select("performance_video_id, rating"),
    supabase
      .from("reviews")
      .select("id, performance_video_id, display_name, rating, text, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("review_likes").select("review_id, user_id"),
    supabase.auth.getUser(),
  ]);

  throwIfError("Loading performances", performancesResult.error);
  throwIfError("Loading songs", songsResult.error);
  throwIfError("Loading ratings", ratingsResult.error);
  throwIfError("Loading reviews", reviewsResult.error);
  throwIfError("Loading review likes", likesResult.error);

  const songsByPerformance = new Map<string, SongRow[]>();
  for (const song of (songsResult.data ?? []) as SongRow[]) {
    const songs = songsByPerformance.get(song.performance_video_id) ?? [];
    songs.push(song);
    songsByPerformance.set(song.performance_video_id, songs);
  }

  const ratingsByPerformance = new Map<string, number[]>();
  for (const rating of ratingsResult.data ?? []) {
    const ratings = ratingsByPerformance.get(rating.performance_video_id) ?? [];
    ratings.push(Number(rating.rating));
    ratingsByPerformance.set(rating.performance_video_id, ratings);
  }

  const reviewsByPerformance = new Map<string, Performance["reviews"]>();
  const currentUserId = authResult.data.user?.id ?? null;
  const likesByReview = new Map<string, { count: number; liked: boolean }>();
  for (const like of likesResult.data ?? []) {
    const current = likesByReview.get(like.review_id) ?? { count: 0, liked: false };
    current.count += 1;
    current.liked ||= like.user_id === currentUserId;
    likesByReview.set(like.review_id, current);
  }

  for (const review of reviewsResult.data ?? []) {
    const reviews = reviewsByPerformance.get(review.performance_video_id) ?? [];
    const likes = likesByReview.get(review.id) ?? { count: 0, liked: false };
    reviews.push({
      id: review.id,
      user: review.display_name,
      rating: Number(review.rating),
      date: review.created_at,
      text: review.text,
      likeCount: likes.count,
      likedByCurrentUser: likes.liked,
    });
    reviewsByPerformance.set(review.performance_video_id, reviews);
  }

  return ((performancesResult.data ?? []) as PerformanceRow[]).map((row) => {
    const rawSongs = songsByPerformance.get(row.video_id) ?? [];
    const songs = rawSongs.map(mapSong);
    const ratings = ratingsByPerformance.get(row.video_id) ?? [];

    return {
      videoId: row.video_id,
      artist: row.artist,
      date: row.date,
      duration: Number(row.duration),
      method: row.method,
      songs,
      confidence: { avg: Number(row.confidence_avg), min: Number(row.confidence_min) },
      verified: row.verified,
      avgRating: ratings.length
        ? ratings.reduce((total, rating) => total + rating, 0) / ratings.length
        : null,
      ratingCount: ratings.length,
      reviews: reviewsByPerformance.get(row.video_id) ?? [],
    } satisfies Performance;
  });
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
  const performances = await loadPerformances();
  return performances.find((performance) => performance.videoId === videoId) ?? null;
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

export async function getPlaylists(): Promise<PlaylistSummary[]> {
  const supabase = await createClient();
  const [playlistsResult, tracksResult] = await Promise.all([
    supabase
      .from("playlists")
      .select("id, name, owner_name, owner_id, playlist_type")
      .order("updated_at", { ascending: false }),
    supabase
      .from("playlist_tracks")
      .select("playlist_id, performance_video_id, position")
      .order("position"),
  ]);

  throwIfError("Loading playlists", playlistsResult.error);
  throwIfError("Loading playlist track counts", tracksResult.error);

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
    owner: playlist.owner_name,
    type: playlist.playlist_type as PlaylistType,
    ownerId: playlist.owner_id,
    trackCount: trackCounts.get(playlist.id) ?? 0,
    thumbnailVideoId: thumbnailVideoIds.get(playlist.id) ?? null,
  }));
}

export async function getPlaylist(id: string): Promise<Playlist | null> {
  const supabase = await createClient();
  const { data: playlist, error: playlistError } = await supabase
    .from("playlists")
    .select("id, name, owner_name, owner_id, playlist_type")
    .eq("id", id)
    .maybeSingle();
  throwIfError("Loading playlist", playlistError);
  if (!playlist) return null;

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
      owner: playlist.owner_name,
      type: playlist.playlist_type as PlaylistType,
      ownerId: playlist.owner_id,
      tracks: [],
    };
  }

  const { data: performanceRows, error: performancesError } = await supabase
    .from("performances")
    .select("video_id, artist, date, duration")
    .in("video_id", videoIds);
  throwIfError("Loading playlist performances", performancesError);

  const { data: songRows, error: songsError } = await supabase
    .from("songs")
    .select("performance_video_id, song_index, title, clip_start, clip_end")
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
    songClips.push({ clipStart: Number(song.clip_start), clipEnd: Number(song.clip_end) });
    songClipsByPerformance.set(song.performance_video_id, songClips);
  }

  let displayIndex = 0;

  return {
    id: playlist.id,
    name: playlist.name,
    owner: playlist.owner_name,
    type: playlist.playlist_type as PlaylistType,
    ownerId: playlist.owner_id,
    tracks: (tracks ?? []).flatMap((track) => {
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
          performanceLabel: `Tiny Desk Concert${performance.date ? ` · ${performance.date}` : ""}`,
          performanceVideoId: performance.video_id,
          songIndex: null,
          clipStart: firstPlayableSong?.clipStart ?? 0,
          clipEnd: duration,
          duration,
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
        performanceLabel: `Tiny Desk Concert${performance.date ? ` · ${performance.date}` : ""}`,
        performanceVideoId: performance.video_id,
        songIndex: song.song_index,
        clipStart: Number(song.clip_start),
        clipEnd: Number(song.clip_end),
        duration: Math.max(0, Number(song.clip_end) - Number(song.clip_start)),
        songClips: [],
      }];
    }),
  };
}

export async function getPlaylistSongOptions(): Promise<PlaylistSongOption[]> {
  const performances = await loadPerformances();

  return performances.flatMap((performance) =>
    performance.songs.map((song) => ({
      performanceVideoId: performance.videoId,
      songIndex: song.index,
      title: song.title,
      artist: performance.artist,
      performanceLabel: `Tiny Desk Concert${performance.date ? ` · ${performance.date}` : ""}`,
      clipStart: song.clipStart,
      clipEnd: song.clipEnd,
      duration: Math.max(0, song.clipEnd - song.clipStart),
    })),
  );
}

export async function getPlaylistVideoOptions(): Promise<PlaylistVideoOption[]> {
  const performances = await loadPerformances();

  return performances.map((performance) => ({
    performanceVideoId: performance.videoId,
    title: performance.artist,
    artist: performance.artist,
    performanceLabel: `Tiny Desk Concert${performance.date ? ` · ${performance.date}` : ""}`,
    duration: performance.duration,
    songClips: performance.songs.map(({ clipStart, clipEnd }) => ({ clipStart, clipEnd })),
  }));
}
