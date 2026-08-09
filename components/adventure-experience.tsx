"use client";

import { useCallback, useState } from "react";
import { AddToPlaylistButton } from "@/components/add-to-playlist-button";
import { PlaylistPlayer } from "@/components/playlist-player";
import { formatTime } from "@/lib/format";
import type {
  PlaylistSongOption,
  PlaylistSummary,
  PlaylistTrack,
  PlaylistVideoOption,
} from "@/lib/types";

type AdventureSource = "songs" | "videos";
type AdventureMode = "song-only" | "normal";

type AdventureSession = {
  source: AdventureSource;
  mode: AdventureMode;
  tracks: PlaylistTrack[];
};

function shuffle<T>(items: readonly T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function makeSongTracks(options: PlaylistSongOption[]): PlaylistTrack[] {
  return options
    .filter((song) => song.clipEnd > song.clipStart)
    .map((song, index) => ({
      ...song,
      index: index + 1,
      position: index + 1,
      songClips: [],
    }));
}

function makeVideoTracks(options: PlaylistVideoOption[], mode: AdventureMode): PlaylistTrack[] {
  return options
    .filter((video) => video.duration > 0)
    .map((video, index) => {
      const firstPlayableSong = video.songClips.find((clip) => clip.clipEnd > clip.clipStart);
      return {
        ...video,
        index: index + 1,
        position: index + 1,
        songIndex: null,
        clipStart: mode === "song-only" ? firstPlayableSong?.clipStart ?? 0 : 0,
        clipEnd: video.duration,
        songClips: video.songClips,
      };
    });
}

function sourceLabel(source: AdventureSource) {
  return source === "songs" ? "Songs" : "Videos";
}

function modeLabel(mode: AdventureMode) {
  return mode === "song-only" ? "Song-only mode" : "Normal mode";
}

function AdventureSetup({
  songOptions,
  videoOptions,
  source,
  mode,
  onSourceChange,
  onModeChange,
  onStart,
}: {
  songOptions: PlaylistSongOption[];
  videoOptions: PlaylistVideoOption[];
  source: AdventureSource;
  mode: AdventureMode;
  onSourceChange: (source: AdventureSource) => void;
  onModeChange: (mode: AdventureMode) => void;
  onStart: () => void;
}) {
  const availableCount = source === "songs" ? songOptions.length : videoOptions.length;
  const availableLabel = source === "songs" ? "song clips" : "performances";

  return (
    <main className="p-8">
      <div className="mx-auto max-w-[920px]">
        <div className="mb-8 max-w-[650px]">
          <div className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            Random listening
          </div>
          <h1 className="mb-2 text-[32px] font-bold text-foreground">I&apos;m feeling adventurous</h1>
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            Let Tiny Office choose what plays next. Set the kind of discovery you want, then press start for a shuffled queue.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-1 text-sm font-semibold text-foreground">What should we play?</h2>
            <p className="mb-4 text-[12.5px] text-muted-foreground">Choose individual song clips or full Tiny Desk performances.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                ["songs", "Songs", "Jump between individual songs from the catalog."],
                ["videos", "Videos", "Play full performances in a random order."],
              ] as const).map(([value, label, description]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={source === value}
                  onClick={() => onSourceChange(value)}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    source === value
                      ? "border-primary/60 bg-primary/10"
                      : "border-border bg-secondary/35 hover:border-primary/40"
                  }`}
                >
                  <div className={`text-sm font-semibold ${source === value ? "text-primary" : "text-foreground"}`}>
                    {label}
                  </div>
                  <div className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{description}</div>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-1 text-sm font-semibold text-foreground">How should it play?</h2>
            <p className="mb-4 text-[12.5px] text-muted-foreground">
              Song-only mode matters most for videos: it skips the gaps between mapped songs.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                ["song-only", "Song only", "Skip non-song gaps and keep the music moving."],
                ["normal", "Normal", "Let each performance play naturally from start to finish."],
              ] as const).map(([value, label, description]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={mode === value}
                  onClick={() => onModeChange(value)}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    mode === value
                      ? "border-primary/60 bg-primary/10"
                      : "border-border bg-secondary/35 hover:border-primary/40"
                  }`}
                >
                  <div className={`text-sm font-semibold ${mode === value ? "text-primary" : "text-foreground"}`}>
                    {label}
                  </div>
                  <div className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{description}</div>
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-5 flex flex-col items-start justify-between gap-4 rounded-xl border border-border bg-secondary/25 p-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {availableCount.toLocaleString()} {availableLabel} ready
            </p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              You can save any pick to one of your private playlists while it plays.
            </p>
          </div>
          <button
            type="button"
            onClick={onStart}
            disabled={availableCount === 0}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Start the adventure
          </button>
        </div>
      </div>
    </main>
  );
}

function AdventureSessionPlayer({
  session,
  playlists,
  isSignedIn,
  onRestart,
}: {
  session: AdventureSession;
  playlists: PlaylistSummary[];
  isSignedIn: boolean;
  onRestart: () => void;
}) {
  const [currentTrack, setCurrentTrack] = useState<PlaylistTrack | null>(session.tracks[0] ?? null);
  const handleCurrentTrackChange = useCallback((track: PlaylistTrack) => {
    setCurrentTrack(track);
  }, []);

  const currentItem = currentTrack?.songIndex === null
    ? currentTrack
      ? { kind: "video" as const, performanceVideoId: currentTrack.performanceVideoId }
      : null
    : currentTrack
      ? {
          kind: "song" as const,
          performanceVideoId: currentTrack.performanceVideoId,
          songIndex: currentTrack.songIndex,
        }
      : null;
  const compatiblePlaylists = playlists.filter((playlist) => playlist.type === session.source);

  return (
    <main className="p-8">
      <div className="mx-auto max-w-[920px]">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              Adventure queue · {sourceLabel(session.source)} · {modeLabel(session.mode)}
            </div>
            <h1 className="text-[28px] font-bold text-foreground">Your random picks</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Everything is shuffled. Save a favorite whenever one finds you.
            </p>
          </div>
          <button
            type="button"
            onClick={onRestart}
            className="self-start rounded-lg border border-input px-3.5 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground sm:self-auto"
          >
            Change settings
          </button>
        </div>

        <PlaylistPlayer
          tracks={session.tracks}
          playlistType={session.source}
          selectedIndex={null}
          onSelectionConsumed={() => undefined}
          onlySongMode={session.mode === "song-only"}
          onCurrentTrackChange={handleCurrentTrackChange}
        />

        {currentTrack && currentItem && (
          <section className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center">
            <div className="min-w-0">
              <div className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Current pick
              </div>
              <h2 className="truncate text-lg font-semibold text-foreground">{currentTrack.title}</h2>
              <p className="mt-1 truncate text-[13px] text-muted-foreground">
                {currentTrack.artist} · {currentTrack.performanceLabel} · {formatTime(currentTrack.duration)}
              </p>
            </div>
            <div className="shrink-0">
              <AddToPlaylistButton
                item={currentItem}
                playlists={compatiblePlaylists}
                isSignedIn={isSignedIn}
                returnPath="/adventure"
              />
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

export function AdventureExperience({
  songOptions,
  videoOptions,
  playlists,
  isSignedIn,
}: {
  songOptions: PlaylistSongOption[];
  videoOptions: PlaylistVideoOption[];
  playlists: PlaylistSummary[];
  isSignedIn: boolean;
}) {
  const [source, setSource] = useState<AdventureSource>("songs");
  const [mode, setMode] = useState<AdventureMode>("song-only");
  const [session, setSession] = useState<AdventureSession | null>(null);

  function startAdventure() {
    const tracks = source === "songs"
      ? makeSongTracks(songOptions)
      : makeVideoTracks(videoOptions, mode);
    if (tracks.length === 0) return;
    setSession({ source, mode, tracks: shuffle(tracks) });
  }

  if (session) {
    return (
      <AdventureSessionPlayer
        session={session}
        playlists={playlists}
        isSignedIn={isSignedIn}
        onRestart={() => setSession(null)}
      />
    );
  }

  return (
    <AdventureSetup
      songOptions={songOptions}
      videoOptions={videoOptions}
      source={source}
      mode={mode}
      onSourceChange={setSource}
      onModeChange={setMode}
      onStart={startAdventure}
    />
  );
}
