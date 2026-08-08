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

type CorrectionRow = {
  performance_video_id: string;
  song_index: number;
  action: "nudge_start" | "nudge_end" | "confirm" | "skip" | "mark_bad";
  clip_start: number | null;
  clip_end: number | null;
  created_at: string;
};

function throwIfError(label: string, error: { message: string } | null) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

function latestCorrections(rows: CorrectionRow[]) {
  const latest = new Map<string, CorrectionRow>();
  for (const row of rows) {
    const key = `${row.performance_video_id}:${row.song_index}`;
    if (!latest.has(key)) latest.set(key, row);
  }
  return latest;
}

function correctSong(song: SongRow, correction: CorrectionRow | undefined): Song {
  return {
    index: song.song_index,
    title: song.title,
    clipStart: correction?.clip_start ?? song.clip_start,
    clipEnd: correction?.clip_end ?? song.clip_end,
    confidence: song.confidence,
    suspect:
      correction?.action === "mark_bad"
        ? true
        : correction?.action === "confirm"
          ? false
          : song.suspect,
  };
}

async function loadPerformances(): Promise<Performance[]> {
  const supabase = await createClient();
  const [performancesResult, songsResult, ratingsResult, reviewsResult, correctionsResult] = await Promise.all([
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
      .select("performance_video_id, display_name, rating, text, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("song_corrections")
      .select("performance_video_id, song_index, action, clip_start, clip_end, created_at")
      .order("created_at", { ascending: false }),
  ]);

  throwIfError("Loading performances", performancesResult.error);
  throwIfError("Loading songs", songsResult.error);
  throwIfError("Loading ratings", ratingsResult.error);
  throwIfError("Loading reviews", reviewsResult.error);
  throwIfError("Loading corrections", correctionsResult.error);

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
  for (const review of reviewsResult.data ?? []) {
    const reviews = reviewsByPerformance.get(review.performance_video_id) ?? [];
    reviews.push({
      user: review.display_name,
      rating: Number(review.rating),
      date: review.created_at,
      text: review.text,
    });
    reviewsByPerformance.set(review.performance_video_id, reviews);
  }

  const corrections = latestCorrections((correctionsResult.data ?? []) as CorrectionRow[]);

  return ((performancesResult.data ?? []) as PerformanceRow[]).map((row) => {
    const rawSongs = songsByPerformance.get(row.video_id) ?? [];
    const songs = rawSongs.map((song) =>
      correctSong(song, corrections.get(`${row.video_id}:${song.song_index}`)),
    );
    const ratings = ratingsByPerformance.get(row.video_id) ?? [];
    const confirmed =
      songs.length > 0 &&
      songs.every((song) => corrections.get(`${row.video_id}:${song.index}`)?.action === "confirm");

    return {
      videoId: row.video_id,
      artist: row.artist,
      date: row.date,
      duration: Number(row.duration),
      method: row.method,
      songs,
      confidence: { avg: Number(row.confidence_avg), min: Number(row.confidence_min) },
      verified: row.verified || confirmed,
      avgRating: ratings.length
        ? ratings.reduce((total, rating) => total + rating, 0) / ratings.length
        : null,
      ratingCount: ratings.length,
      reviews: reviewsByPerformance.get(row.video_id) ?? [],
    } satisfies Performance;
  });
}

/**
 * DATA SEAM — every function here is async and returns plain data, backed
 * right now by the fixtures in lib/fixtures/. That's deliberate: swap a
 * function body for a Supabase query and no call site (page component)
 * needs to change, because they already treat this as an async data layer.
 *
 * Nothing here does real auth, real playback state, or real writes
 * (ratings/reviews/reorder/nudge-boundary). Those need a backend first.
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
    supabase.from("playlist_tracks").select("playlist_id"),
  ]);

  throwIfError("Loading playlists", playlistsResult.error);
  throwIfError("Loading playlist track counts", tracksResult.error);

  const trackCounts = new Map<string, number>();
  for (const track of tracksResult.data ?? []) {
    trackCounts.set(track.playlist_id, (trackCounts.get(track.playlist_id) ?? 0) + 1);
  }

  return (playlistsResult.data ?? []).map((playlist) => ({
    id: playlist.id,
    name: playlist.name,
    owner: playlist.owner_name,
    type: playlist.playlist_type as PlaylistType,
    ownerId: playlist.owner_id,
    trackCount: trackCounts.get(playlist.id) ?? 0,
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

  const songsResult = playlist.playlist_type === "songs"
    ? await supabase
        .from("songs")
        .select("performance_video_id, song_index, title, clip_start, clip_end")
        .in("performance_video_id", videoIds)
    : null;
  if (songsResult) throwIfError("Loading playlist songs", songsResult.error);

  const performances = new Map((performanceRows ?? []).map((performance) => [performance.video_id, performance]));
  const songs = new Map(
    (songsResult?.data ?? []).map((song) => [`${song.performance_video_id}:${song.song_index}`, song]),
  );

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
        return [{
          index: displayIndex,
          position: track.position,
          title: performance.artist,
          artist: performance.artist,
          performanceLabel: `Tiny Desk Concert${performance.date ? ` · ${performance.date}` : ""}`,
          performanceVideoId: performance.video_id,
          songIndex: null,
          clipStart: 0,
          clipEnd: duration,
          duration,
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
  }));
}
