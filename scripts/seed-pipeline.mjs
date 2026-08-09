import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !secretKey) {
  throw new Error(
    "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY before running npm run seed:pipeline.",
  );
}

const supabase = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const reportsDir = join(process.cwd(), "data", "pipeline-reports");
const reportFiles = (await readdir(reportsDir))
  .filter((file) => file.endsWith(".json") && file !== "_mass_pull_summary.json")
  .sort();

const reports = await Promise.all(
  reportFiles.map(async (file) => JSON.parse(await readFile(join(reportsDir, file), "utf8"))),
);

if (reports.length !== 48) {
  throw new Error(`Expected exactly 48 refined_v2 reports, found ${reports.length}.`);
}

const reportVideoIds = reports.map((report) => report.video_id);
if (reportVideoIds.some((videoId) => typeof videoId !== "string" || videoId.length === 0)) {
  throw new Error("Every refined_v2 report must have a non-empty video_id.");
}
if (new Set(reportVideoIds).size !== reportVideoIds.length) {
  throw new Error("The refined_v2 snapshot contains duplicate video IDs.");
}
if (reportVideoIds.includes("gMp0SlkVU8w") || reportVideoIds.includes("K6tzeZLjUNE")) {
  throw new Error("The invalid gMp0SlkVU8w/K6tzeZLjUNE IDs must stay excluded.");
}

const artistFromTitle = (title) => title.split(":", 1)[0].trim() || title.trim();
const confidenceValue = (value) => (typeof value === "number" ? value : 0);

const performances = reports.map((report) => ({
  video_id: report.video_id,
  artist: artistFromTitle(report.title),
  date: null,
  duration: Math.max(0, Math.round(Number(report.duration) || 0)),
  method: report.method,
  confidence_avg: confidenceValue(report.confidence?.avg),
  confidence_min: confidenceValue(report.confidence?.min),
  verified: confidenceValue(report.confidence?.min) >= 75,
  source_title: report.title,
}));

const songs = reports.flatMap((report) =>
  (report.candidates ?? []).map((candidate, index) => ({
    performance_video_id: report.video_id,
    song_index: index + 1,
    title: String(candidate.song ?? "Untitled"),
    clip_start: Number(candidate.clip_start) || 0,
    clip_end: Number(candidate.clip_end) || 0,
    confidence: confidenceValue(candidate.confidence),
    suspect: Boolean(candidate.suspect),
  })),
);

const reportVideoIdSet = new Set(reportVideoIds);
const expectedSongKeys = new Set(
  songs.map((song) => `${song.performance_video_id}:${song.song_index}`),
);

const { data: existingPerformances, error: existingPerformancesError } = await supabase
  .from("performances")
  .select("video_id");
if (existingPerformancesError) throw existingPerformancesError;

const staleVideoIds = (existingPerformances ?? [])
  .map((performance) => performance.video_id)
  .filter((videoId) => !reportVideoIdSet.has(videoId));

if (staleVideoIds.length > 0) {
  const { error } = await supabase
    .from("performances")
    .delete()
    .in("video_id", staleVideoIds);
  if (error) throw error;
  console.log(`Removed ${staleVideoIds.length} stale performances: ${staleVideoIds.join(", ")}`);
}

const { data: existingSongs, error: existingSongsError } = await supabase
  .from("songs")
  .select("performance_video_id, song_index")
  .in("performance_video_id", reportVideoIds);
if (existingSongsError) throw existingSongsError;

const obsoleteSongIndexes = new Map();
for (const song of existingSongs ?? []) {
  const key = `${song.performance_video_id}:${song.song_index}`;
  if (!expectedSongKeys.has(key)) {
    const indexes = obsoleteSongIndexes.get(song.performance_video_id) ?? [];
    indexes.push(song.song_index);
    obsoleteSongIndexes.set(song.performance_video_id, indexes);
  }
}

let removedSongCount = 0;
for (const [videoId, songIndexes] of obsoleteSongIndexes) {
  const { error } = await supabase
    .from("songs")
    .delete()
    .eq("performance_video_id", videoId)
    .in("song_index", songIndexes);
  if (error) throw error;
  removedSongCount += songIndexes.length;
}
if (removedSongCount > 0) {
  console.log(`Removed ${removedSongCount} obsolete songs from the refined_v2 IDs.`);
}

const { error: performancesError } = await supabase
  .from("performances")
  .upsert(performances, { onConflict: "video_id" });
if (performancesError) throw performancesError;

if (songs.length > 0) {
  const { error: songsError } = await supabase
    .from("songs")
    .upsert(songs, { onConflict: "performance_video_id,song_index" });
  if (songsError) throw songsError;
}

const demoPlaylist = {
  id: "late-night-sets",
  name: "Late Night Sets",
  playlist_type: "songs",
  owner_name: "You",
  visibility: "public",
};

const { error: playlistError } = await supabase.from("playlists").upsert(demoPlaylist, { onConflict: "id" });
if (playlistError) throw playlistError;

const demoTracks = [
  [1, "XfzpYcwiUrA", 1],
  [2, "jIIuzB11dsA", 1],
  [3, "FvVnP8G6ITs", 1],
  [4, "ferZnZ0_rSM", 1],
  [6, "y38qQRg3UDI", 4],
  [7, "cMIJsoaxRjk", 6],
].map(([position, performance_video_id, song_index]) => ({
  playlist_id: demoPlaylist.id,
  position,
  performance_video_id,
  song_index,
}));

if (demoTracks.some((track) => !reportVideoIdSet.has(track.performance_video_id))) {
  throw new Error("The demo playlist contains a video outside the refined_v2 snapshot.");
}

const { error: tracksError } = await supabase
  .from("playlist_tracks")
  .upsert(demoTracks, { onConflict: "playlist_id,position" });
if (tracksError) throw tracksError;

console.log(`Seeded ${performances.length} performances and ${songs.length} songs.`);
