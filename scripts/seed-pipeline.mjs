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

const EXPECTED_REPORT_COUNT = 199;
const reportsDir = join(process.cwd(), "data", "pipeline-reports");
const REPORT_VARIANTS = [
  {
    key: "no-audience",
    name: "No audience · tighter cut",
    description: "Stops song clips before audience applause and room response.",
    directory: reportsDir,
  },
  {
    key: "with-audience",
    name: "With applause · less tight cut",
    description: "Keeps more of the applause and room response around each song.",
    directory: join(reportsDir, "with-audience"),
  },
];

async function readReports(directory, variantKey) {
  const reportFiles = (await readdir(directory))
    .filter((file) => file.endsWith(".json") && file !== "_mass_pull_summary.json")
    .sort();
  const reports = await Promise.all(
    reportFiles.map(async (file) => JSON.parse(await readFile(join(directory, file), "utf8"))),
  );

  if (reports.length !== EXPECTED_REPORT_COUNT) {
    throw new Error(
      `Expected exactly ${EXPECTED_REPORT_COUNT} ${variantKey} reports, found ${reports.length}.`,
    );
  }

  const reportVideoIds = reports.map((report) => report.video_id);
  if (reportVideoIds.some((videoId) => typeof videoId !== "string" || videoId.length === 0)) {
    throw new Error(`Every ${variantKey} report must have a non-empty video_id.`);
  }
  if (new Set(reportVideoIds).size !== reportVideoIds.length) {
    throw new Error(`The ${variantKey} snapshot contains duplicate video IDs.`);
  }
  if (reportVideoIds.includes("gMp0SlkVU8w")) {
    throw new Error("The failed gMp0SlkVU8w ID must stay excluded.");
  }

  return reports;
}

const reportsByVariant = new Map(
  await Promise.all(
    REPORT_VARIANTS.map(async (variant) => [variant.key, await readReports(variant.directory, variant.key)]),
  ),
);
const reports = reportsByVariant.get("no-audience");
const previousReports = reportsByVariant.get("with-audience");
const reportVideoIds = reports.map((report) => report.video_id);
const previousReportVideoIds = previousReports.map((report) => report.video_id);
if (reportVideoIds.some((videoId, index) => videoId !== previousReportVideoIds[index])) {
  throw new Error("The no-audience and with-audience snapshots must contain the same video IDs.");
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

const makeSongs = (variantReports, variantKey) => variantReports.flatMap((report) =>
  (report.candidates ?? []).map((candidate, index) => ({
    variant_key: variantKey,
    performance_video_id: report.video_id,
    song_index: index + 1,
    title: String(candidate.song ?? "Untitled"),
    clip_start: Number(candidate.clip_start) || 0,
    clip_end: Number(candidate.clip_end) || 0,
    confidence: confidenceValue(candidate.confidence),
    suspect: Boolean(candidate.suspect),
  })),
);

const songs = makeSongs(reports, "no-audience").map(({ variant_key, ...song }) => {
  if (variant_key !== "no-audience") throw new Error("Unexpected default cut variant key.");
  return song;
});
const variantSongs = REPORT_VARIANTS.flatMap((variant) =>
  makeSongs(reportsByVariant.get(variant.key), variant.key),
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

const { error: variantsError } = await supabase
  .from("performance_cut_variants")
  .upsert(
    REPORT_VARIANTS.map((variant, sortOrder) => ({
      variant_key: variant.key,
      name: variant.name,
      description: variant.description,
      is_default: variant.key === "no-audience",
      sort_order: sortOrder,
    })),
    { onConflict: "variant_key" },
  );
if (variantsError) throw variantsError;

const expectedVariantSongKeys = new Set(
  variantSongs.map((song) => `${song.variant_key}:${song.performance_video_id}:${song.song_index}`),
);
const { data: existingVariantSongs, error: existingVariantSongsError } = await supabase
  .from("performance_cut_variant_songs")
  .select("variant_key, performance_video_id, song_index")
  .in("performance_video_id", reportVideoIds);
if (existingVariantSongsError) throw existingVariantSongsError;

const obsoleteVariantSongIndexes = new Map();
for (const song of existingVariantSongs ?? []) {
  const key = `${song.variant_key}:${song.performance_video_id}:${song.song_index}`;
  if (!expectedVariantSongKeys.has(key)) {
    const indexesByVideo = obsoleteVariantSongIndexes.get(song.variant_key) ?? new Map();
    const indexes = indexesByVideo.get(song.performance_video_id) ?? [];
    indexes.push(song.song_index);
    indexesByVideo.set(song.performance_video_id, indexes);
    obsoleteVariantSongIndexes.set(song.variant_key, indexesByVideo);
  }
}

let removedVariantSongCount = 0;
for (const [variantKey, indexesByVideo] of obsoleteVariantSongIndexes) {
  for (const [videoId, songIndexes] of indexesByVideo) {
    const { error } = await supabase
      .from("performance_cut_variant_songs")
      .delete()
      .eq("variant_key", variantKey)
      .eq("performance_video_id", videoId)
      .in("song_index", songIndexes);
    if (error) throw error;
    removedVariantSongCount += songIndexes.length;
  }
}
if (removedVariantSongCount > 0) {
  console.log(`Removed ${removedVariantSongCount} obsolete cut-variant songs.`);
}

if (variantSongs.length > 0) {
  const { error: variantSongsError } = await supabase
    .from("performance_cut_variant_songs")
    .upsert(variantSongs, { onConflict: "variant_key,performance_video_id,song_index" });
  if (variantSongsError) throw variantSongsError;
}

console.log(
  `Seeded ${performances.length} default performances, ${songs.length} default songs, and ${variantSongs.length} cut-variant songs.`,
);
