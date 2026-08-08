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

const { error: performancesError } = await supabase
  .from("performances")
  .upsert(performances, { onConflict: "video_id" });
if (performancesError) throw performancesError;

const { error: songsError } = await supabase
  .from("songs")
  .upsert(songs, { onConflict: "performance_video_id,song_index" });
if (songsError) throw songsError;

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
  ["XfzpYcwiUrA", 1],
  ["jIIuzB11dsA", 1],
  ["FvVnP8G6ITs", 1],
  ["ferZnZ0_rSM", 1],
  ["lkDYKk9k-2E", 3],
  ["y38qQRg3UDI", 4],
  ["cMIJsoaxRjk", 6],
].map(([performance_video_id, song_index], position) => ({
  playlist_id: demoPlaylist.id,
  position: position + 1,
  performance_video_id,
  song_index,
}));

const { error: tracksError } = await supabase
  .from("playlist_tracks")
  .upsert(demoTracks, { onConflict: "playlist_id,position" });
if (tracksError) throw tracksError;

console.log(`Seeded ${performances.length} performances and ${songs.length} songs.`);
