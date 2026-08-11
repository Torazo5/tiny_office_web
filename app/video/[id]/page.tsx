import { notFound } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { PlayerProvider } from "@/components/player-context";
import { SongRow } from "@/components/song-row";
import { StarRating } from "@/components/star-rating";
import { RatingReviewPanel } from "@/components/rating-review-panel";
import { VideoEmbed } from "@/components/video-embed";
import { VideoFeatureHints } from "@/components/feature-hints";
import { AddToPlaylistButton } from "@/components/add-to-playlist-button";
import { PresetPicker } from "@/components/preset-picker";
import { ReviewLikeButton } from "@/components/review-like-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getCurrentUser } from "@/lib/auth";
import { getPlaylists } from "@/lib/data";
import { getPerformanceWithSelectedPreset } from "@/lib/review-data";
import { getUserEngagement } from "@/lib/engagement-data";
import { getPlaybackDefaults } from "@/lib/profile-data";
import { DEFAULT_PLAYBACK_SETTINGS } from "@/lib/playback-settings";

export default async function VideoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ preset_id?: string }>;
}) {
  const { id } = await params;
  const { preset_id: previewPresetId } = await searchParams;
  const user = await getCurrentUser();
  const [{ performance, presets, selectedPreset, selectedCut }, engagement, playlists, playbackDefaults] = await Promise.all([
    getPerformanceWithSelectedPreset(id, user?.id, previewPresetId),
    getUserEngagement(id, user?.id),
    getPlaylists(user?.id ?? null),
    user ? getPlaybackDefaults(user.id) : Promise.resolve(DEFAULT_PLAYBACK_SETTINGS),
  ]);
  if (!performance) notFound();
  const songPlaylists = user
    ? playlists.filter((playlist) => playlist.ownerId === user.id && playlist.type === "songs")
    : [];
  const videoPlaylists = user
    ? playlists.filter((playlist) => playlist.ownerId === user.id && playlist.type === "videos")
    : [];
  const methodLabel = {
    comments: "comments",
    yamnet: "YAMNet",
    silence: "silence detection",
    transcript: "transcript",
    manual: "manual review",
  }[performance.method];
  const revisionHref = `/review/${performance.videoId}?cut=${selectedCut?.key ?? "no-audience"}`;

  return (
    <>
      <Header user={user} />
      <PlayerProvider
        initialStart={performance.songs[0]?.clipStart ?? 0}
        songs={performance.songs}
        initialPlaybackSettings={playbackDefaults}
        isSignedIn={Boolean(user)}
      >
        <main className="grid min-w-0 items-start gap-8 p-4 sm:p-8 lg:grid-cols-2 lg:gap-5">
          <div className="min-w-0">
            <VideoEmbed videoId={performance.videoId} duration={performance.duration} />
            <VideoFeatureHints />

            <h1 className="text-2xl font-bold text-foreground mb-1.5">{performance.artist}</h1>
            <p className="text-sm text-muted-foreground mb-4">
              Tiny Desk Concert{performance.date ? ` · ${performance.date}` : ""} · NPR Music
            </p>
            <p className="mb-4 text-[11px] text-muted-foreground/70">Used {methodLabel}</p>

            <RatingReviewPanel
              videoId={performance.videoId}
              isSignedIn={Boolean(user)}
              initialRating={engagement.rating}
              initialReview={engagement.review}
            />

            <div className="mb-4 flex items-center gap-3.5">
              <AddToPlaylistButton
                item={{ kind: "video", performanceVideoId: performance.videoId }}
                playlists={videoPlaylists}
                isSignedIn={Boolean(user)}
                returnPath={`/video/${performance.videoId}`}
              />
            </div>

            <div data-feature-hint="timeline-editor" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg">
              <Link
                href={revisionHref}
                className="rounded-lg bg-primary px-3.5 py-2 text-[13px] font-semibold text-primary-foreground"
              >
                Customize timeline
              </Link>
              <Link
                href={revisionHref}
                className="text-[12.5px] font-medium text-muted-foreground hover:text-foreground"
              >
                Open revision editor →
              </Link>
            </div>

            <PresetPicker
              videoId={performance.videoId}
              variantKey={selectedCut?.key ?? "no-audience"}
              presets={presets}
              selectedPresetId={selectedPreset?.id ?? null}
              isSignedIn={Boolean(user)}
            />

            <h2 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">
              Reviews
            </h2>
            <div className="flex flex-col gap-4">
              {performance.reviews.length === 0 && (
                <p className="text-[13px] text-muted-foreground/70">No reviews yet.</p>
              )}
              {performance.reviews.map((rev, i) => (
                <div key={rev.id ?? i} className="flex gap-3">
                  <Avatar size="default">
                    <AvatarImage src={rev.avatarUrl} alt={`${rev.user} profile picture`} />
                    <AvatarFallback>{rev.user.slice(0, 1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="text-[13px] font-semibold text-foreground">{rev.user}</span>
                      <StarRating rating={rev.rating} size="text-[11.5px]" />
                    </div>
                    <p className="text-[13px] leading-relaxed text-muted-foreground">{rev.text}</p>
                    <div className="mt-2">
                      <ReviewLikeButton
                        reviewId={rev.id}
                        videoId={performance.videoId}
                        initialLikeCount={rev.likeCount}
                        initialLiked={rev.likedByCurrentUser}
                        isSignedIn={Boolean(user)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div data-feature-hint="song-list" className="min-w-0 rounded-lg">
            <h2 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Songs in this set
            </h2>
            <div className="flex flex-col gap-0.5">
              {performance.songs.map((song) => (
                <div key={song.index} className="flex min-w-0 items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <SongRow song={song} />
                  </div>
                  <AddToPlaylistButton
                    item={{
                      kind: "song",
                      performanceVideoId: performance.videoId,
                      songIndex: song.index,
                    }}
                    playlists={songPlaylists}
                    isSignedIn={Boolean(user)}
                    returnPath={`/video/${performance.videoId}`}
                  />
                </div>
              ))}
            </div>
          </div>
        </main>
      </PlayerProvider>
    </>
  );
}
