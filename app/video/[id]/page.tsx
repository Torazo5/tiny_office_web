import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { SongRow } from "@/components/song-row";
import { StarRating } from "@/components/star-rating";
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
      <main className="p-8 grid gap-8 items-start" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
        <div>
          {/*
            Real embed goes here once Codex wires the YouTube player
            (iframe src=`https://www.youtube.com/embed/${performance.videoId}`).
            This is a static placeholder — no player instance exists yet
            for song rows to seek against.
          */}
          <div className="relative aspect-video rounded-[10px] bg-black flex items-center justify-center mb-4 border border-border">
            <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
              <div
                className="ml-1"
                style={{
                  width: 0,
                  height: 0,
                  borderStyle: "solid",
                  borderWidth: "12px 0 12px 20px",
                  borderColor: "transparent transparent transparent var(--primary-foreground)",
                }}
              />
            </div>
            <span className="absolute bottom-4 font-mono text-[10.5px] text-muted-foreground/70 tracking-wide">
              YOUTUBE EMBED
            </span>
          </div>

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
    </>
  );
}
