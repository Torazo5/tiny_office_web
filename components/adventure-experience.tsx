"use client";

import { useCallback, useState } from "react";
import { History, Shuffle } from "lucide-react";
import { AddToPlaylistButton } from "@/components/add-to-playlist-button";
import { PlaylistPlayer } from "@/components/playlist-player";
import { AdventurePlayFeatureHints, AdventureSetupFeatureHints } from "@/components/feature-hints";
import { RecentlyPlayedPanel, useRecentlyPlayed } from "@/components/recently-played";
import { trackEvent } from "@/components/analytics";
import type { PlaybackSettings } from "@/lib/playback-settings";
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
  recentlyPlayed,
  onPlayRecentlyPlayed,
  onClearRecentlyPlayed,
}: {
  songOptions: PlaylistSongOption[];
  videoOptions: PlaylistVideoOption[];
  source: AdventureSource;
  mode: AdventureMode;
  onSourceChange: (source: AdventureSource) => void;
  onModeChange: (mode: AdventureMode) => void;
  onStart: () => void;
  recentlyPlayed: PlaylistTrack[];
  onPlayRecentlyPlayed: (track: PlaylistTrack) => void;
  onClearRecentlyPlayed: () => void;
}) {
  const availableCount = source === "songs" ? songOptions.length : videoOptions.length;
  const availableLabel = source === "songs" ? "song clips" : "performances";
  const [showRecentlyPlayed, setShowRecentlyPlayed] = useState(false);

  return (
    <main className="p-4 sm:p-8">
      <div className="mx-auto max-w-[920px]">
        <div className="mb-8 flex flex-col items-start justify-between gap-5 sm:flex-row sm:gap-8">
          <div className="max-w-[650px]">
            <div className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              Random listening
            </div>
            <h1 className="mb-2 text-[32px] font-bold text-foreground">I&apos;m feeling adventurous</h1>
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              Let Tiny Office choose what plays next. Set the kind of discovery you want, then press start for a shuffled queue.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowRecentlyPlayed((isOpen) => !isOpen)}
            aria-expanded={showRecentlyPlayed}
            className={`inline-flex shrink-0 items-center gap-2 rounded-lg border px-3.5 py-2.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
              showRecentlyPlayed
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-input text-muted-foreground hover:border-primary/50 hover:text-foreground"
            }`}
          >
            <History aria-hidden className="size-4" />
            Recently played
            {recentlyPlayed.length > 0 && (
              <span className="rounded-full bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {recentlyPlayed.length}
              </span>
            )}
          </button>
        </div>

        {showRecentlyPlayed && (
          <RecentlyPlayedPanel
            tracks={recentlyPlayed}
            onPlay={onPlayRecentlyPlayed}
            onClear={onClearRecentlyPlayed}
            onClose={() => setShowRecentlyPlayed(false)}
          />
        )}

        <div data-feature-hint="adventure-options" className="grid gap-5 rounded-xl lg:grid-cols-2">
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
            data-feature-hint="adventure-start"
            className="group relative inline-flex items-center gap-2 overflow-hidden rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_0_18px_oklch(0.68_0.17_25_/_0.16)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_24px_oklch(0.68_0.17_25_/_0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-14 -translate-x-full skew-x-[-20deg] bg-white/20 transition-transform duration-700 group-hover:translate-x-[340%]"
            />
            <Shuffle
              aria-hidden
              className="relative size-4 transition-transform duration-300 group-hover:rotate-6"
              strokeWidth={2.3}
            />
            Start the adventure
          </button>
        </div>
        <AdventureSetupFeatureHints />
      </div>
    </main>
  );
}

function AdventureSessionPlayer({
  session,
  playlists,
  isSignedIn,
  onRestart,
  onTrackPlay,
  recentlyPlayed,
  onPlayRecentlyPlayed,
  onClearRecentlyPlayed,
  initialPlaybackSettings,
}: {
  session: AdventureSession;
  playlists: PlaylistSummary[];
  isSignedIn: boolean;
  onRestart: () => void;
  onTrackPlay: (track: PlaylistTrack) => void;
  recentlyPlayed: PlaylistTrack[];
  onPlayRecentlyPlayed: (track: PlaylistTrack) => void;
  onClearRecentlyPlayed: () => void;
  initialPlaybackSettings: PlaybackSettings;
}) {
  const [currentTrack, setCurrentTrack] = useState<PlaylistTrack | null>(session.tracks[0] ?? null);
  const [showRecentlyPlayed, setShowRecentlyPlayed] = useState(false);
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
    <main className="p-4 sm:p-8">
      <div className="mx-auto max-w-[920px]">
        <PlaylistPlayer
          tracks={session.tracks}
          playlistType={session.source}
          selectedIndex={null}
          onSelectionConsumed={() => undefined}
          onlySongMode={session.mode === "song-only"}
          onCurrentTrackChange={handleCurrentTrackChange}
          onTrackPlay={onTrackPlay}
          initialPlaybackSettings={initialPlaybackSettings}
          isSignedIn={isSignedIn}
          playButtonHintTarget="adventure-play"
          sidebarHeader={
            <div>
              <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                Adventure queue · {sourceLabel(session.source)} · {modeLabel(session.mode)}
              </div>
            </div>
          }
        />
        <AdventurePlayFeatureHints />

        <div className="mb-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowRecentlyPlayed((isOpen) => !isOpen)}
            aria-expanded={showRecentlyPlayed}
            className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
              showRecentlyPlayed
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-input text-muted-foreground hover:border-primary/50 hover:text-foreground"
            }`}
          >
            <History aria-hidden className="size-4" />
            Recently played
            {recentlyPlayed.length > 0 && (
              <span className="rounded-full bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {recentlyPlayed.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="rounded-lg border border-input px-3.5 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Change settings
          </button>
          {currentItem && (
            <div className="ml-auto shrink-0">
              <AddToPlaylistButton
                item={currentItem}
                playlists={compatiblePlaylists}
                isSignedIn={isSignedIn}
                returnPath="/adventure"
              />
            </div>
          )}
        </div>

        {showRecentlyPlayed && (
          <RecentlyPlayedPanel
            tracks={recentlyPlayed}
            onPlay={onPlayRecentlyPlayed}
            onClear={onClearRecentlyPlayed}
            onClose={() => setShowRecentlyPlayed(false)}
          />
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
  initialPlaybackSettings,
}: {
  songOptions: PlaylistSongOption[];
  videoOptions: PlaylistVideoOption[];
  playlists: PlaylistSummary[];
  isSignedIn: boolean;
  initialPlaybackSettings: PlaybackSettings;
}) {
  const [source, setSource] = useState<AdventureSource>("songs");
  const [mode, setMode] = useState<AdventureMode>("song-only");
  const [session, setSession] = useState<AdventureSession | null>(null);
  const { tracks: recentlyPlayed, addTrack, clearTracks } = useRecentlyPlayed();
  const sessionKey = session
    ? [
        session.source,
        session.tracks.length,
        session.tracks[0]?.performanceVideoId ?? "empty",
        session.tracks[0]?.songIndex ?? "video",
        session.tracks[0]?.clipStart ?? 0,
      ].join(":")
    : undefined;

  function startAdventure() {
    const tracks = source === "songs"
      ? makeSongTracks(songOptions)
      : makeVideoTracks(videoOptions, mode);
    if (tracks.length === 0) return;
    trackEvent({ eventName: "adventure_started", source, adventureMode: mode });
    setSession({ source, mode, tracks: shuffle(tracks) });
  }

  function playRecentlyPlayed(track: PlaylistTrack) {
    const source = track.songIndex === null ? "videos" : "songs";
    setSession({
      source,
      mode: source === "videos" ? "normal" : "song-only",
      tracks: [{ ...track, index: 1, position: 1 }],
    });
  }

  if (session) {
    return (
      <AdventureSessionPlayer
        key={sessionKey}
        session={session}
        playlists={playlists}
        isSignedIn={isSignedIn}
        onRestart={() => setSession(null)}
        onTrackPlay={addTrack}
        recentlyPlayed={recentlyPlayed}
        onPlayRecentlyPlayed={playRecentlyPlayed}
        onClearRecentlyPlayed={clearTracks}
        initialPlaybackSettings={initialPlaybackSettings}
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
      recentlyPlayed={recentlyPlayed}
      onPlayRecentlyPlayed={playRecentlyPlayed}
      onClearRecentlyPlayed={clearTracks}
    />
  );
}
