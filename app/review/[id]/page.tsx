import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { Waveform } from "@/components/waveform";
import { formatTime } from "@/lib/format";
import { getPerformance } from "@/lib/data";
import { recordReviewAction } from "@/app/review/actions";

/**
 * Song-by-song boundary confirmation flow. Prev/Next navigate via a real
 * `?song=` query param (no client JS needed for that part). The action
 * buttons (nudge/confirm/skip/mark bad) are visual-only — they need a
 * backend to persist a correction (this is exactly the
 * scripts/review.py workflow PIPELINE.md describes, moved into the
 * browser) and a Server Action or API route is Codex's job, not this
 * scaffold's.
 */
export default async function ReviewFlowPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ song?: string }>;
}) {
  const { id } = await params;
  const { song: songParam } = await searchParams;
  const performance = await getPerformance(id);
  if (!performance) notFound();

  const total = performance.songs.length;
  const requested = songParam ? parseInt(songParam, 10) : 1;
  const current = Math.min(Math.max(1, Number.isFinite(requested) ? requested : 1), total);
  const song = performance.songs[current - 1];

  const prevHref = `/review/${id}?song=${Math.max(1, current - 1)}`;
  const nextHref = `/review/${id}?song=${Math.min(total, current + 1)}`;

  return (
    <>
      <Header progressLabel={`Song ${current} of ${total}`} />
      <main className="p-8 max-w-[900px] mx-auto">
        <h1 className="text-xl font-semibold text-foreground mb-0.5">{performance.artist}</h1>
        <p className="text-[13px] text-muted-foreground mb-5.5">Confirming song boundaries</p>

        <div className="bg-card border border-border rounded-[10px] p-5 mb-4.5">
          <div className="text-[15px] font-semibold text-foreground mb-0.5">{song.title}</div>
          <div className="font-mono text-xs text-muted-foreground mb-4.5">
            clip {formatTime(song.clipStart)} &ndash; {formatTime(song.clipEnd)}
          </div>

          <Waveform
            durationSec={performance.duration}
            clipStart={song.clipStart}
            clipEnd={song.clipEnd}
          />

          <div className="flex justify-between mt-1.5 font-mono text-[11px] text-muted-foreground/70">
            <span>0:00</span>
            <span>{formatTime(performance.duration)}</span>
          </div>
        </div>

        <form action={recordReviewAction} className="flex gap-2.5 flex-wrap mb-5.5">
          <input type="hidden" name="performance_video_id" value={performance.videoId} />
          <input type="hidden" name="song_index" value={song.index} />
          <input type="hidden" name="clip_start" value={song.clipStart} />
          <input type="hidden" name="clip_end" value={song.clipEnd} />
          <button
            name="action"
            value="nudge_start"
            className="text-[13px] font-medium px-3.5 py-2 rounded-lg border border-input bg-card text-foreground/80 cursor-not-allowed"
          >
            &larr; Nudge start
          </button>
          <button
            name="action"
            value="nudge_end"
            className="text-[13px] font-medium px-3.5 py-2 rounded-lg border border-input bg-card text-foreground/80 cursor-not-allowed"
          >
            Nudge end &rarr;
          </button>
          <div className="flex-1" />
          <button name="action" value="mark_bad" className="text-[13px] font-medium px-4 py-2 rounded-lg text-primary/80">
            Mark bad
          </button>
          <button
            name="action"
            value="skip"
            className="text-[13px] font-medium px-4 py-2 rounded-lg border border-input text-foreground/70 cursor-not-allowed"
          >
            Skip
          </button>
          <button
            name="action"
            value="confirm"
            className="text-[13px] font-semibold px-4.5 py-2 rounded-lg bg-primary/60 text-primary-foreground cursor-not-allowed"
          >
            Confirm
          </button>
        </form>

        <div className="flex justify-between items-center pt-4 border-t border-border">
          <Link
            href={prevHref}
            aria-disabled={current === 1}
            className={`text-[13px] font-medium px-3.5 py-2 rounded-lg border border-border text-muted-foreground ${
              current === 1 ? "pointer-events-none opacity-40" : "hover:text-foreground"
            }`}
          >
            &larr; Previous song
          </Link>
          <Link
            href={nextHref}
            aria-disabled={current === total}
            className={`text-[13px] font-medium px-3.5 py-2 rounded-lg border border-border text-muted-foreground ${
              current === total ? "pointer-events-none opacity-40" : "hover:text-foreground"
            }`}
          >
            Next song &rarr;
          </Link>
        </div>
      </main>
    </>
  );
}
