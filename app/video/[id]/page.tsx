import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { PlayerProvider } from "@/components/player-context";
import { SongRow } from "@/components/song-row";
import { StarRating } from "@/components/star-rating";
import { VideoEmbed } from "@/components/video-embed";
import { getPerformance } from "@/lib/data";

export default async function VideoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const performance = await getPerformance(id);
  if (!performance) notFound();

  return (
    <>
      <Header />
      <PlayerProvider initialStart={performance.songs[0]?.clipStart ?? 0}>
        <main className="p-8 grid gap-8 items-start" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
          <div>
            <VideoEmbed videoId={performance.videoId} />

            <h1 className="text-2xl font-bold text-foreground mb-1.5">{performance.artist}</h1>
            <p className="text-sm text-muted-foreground mb-4">
              Tiny Desk Concert{performance.date ? ` · ${performance.date}` : ""} · NPR Music
            </p>

            <div className="flex items-center gap-3.5 py-4 border-y border-border mb-4">
              <span className="text-[12.5px] font-medium text-muted-foreground">Your rating</span>
              {/* Unrated placeholder — real per-user rating needs auth first. */}
              <StarRating rating={0} size="text-[19px]" />
              <div className="flex-1" />
              <span className="text-[12.5px] font-medium text-primary cursor-not-allowed">
                Write a review
              </span>
              <span className="text-[12.5px] font-medium text-muted-foreground cursor-not-allowed">
                + Add to list
              </span>
            </div>

            <h2 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">
              Reviews
            </h2>
            <div className="flex flex-col gap-4">
              {performance.reviews.length === 0 && (
                <p className="text-[13px] text-muted-foreground/70">No reviews yet.</p>
              )}
              {performance.reviews.map((rev, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full shrink-0 bg-secondary" />
                  <div>
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="text-[13px] font-semibold text-foreground">{rev.user}</span>
                      <StarRating rating={rev.rating} size="text-[11.5px]" />
                    </div>
                    <p className="text-[13px] leading-relaxed text-muted-foreground">{rev.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Songs in this set
            </h2>
            <div className="flex flex-col gap-0.5">
              {performance.songs.map((song) => (
                <SongRow key={song.index} song={song} />
              ))}
            </div>
          </div>
        </main>
      </PlayerProvider>
    </>
  );
}
