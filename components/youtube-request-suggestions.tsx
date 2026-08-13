import { YouTubeThumbnail } from "@/components/youtube-thumbnail";
import { YouTubeRequestButton } from "@/components/song-request-form";
import type { YouTubeVideoSearchResult } from "@/lib/youtube-search";

function formatDuration(seconds: number | null) {
  if (seconds === null) return null;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function formatPublishedDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-SG", { dateStyle: "medium" }).format(date);
}

export function YouTubeRequestSuggestions({
  query,
  results,
  sourcePath,
}: {
  query: string;
  results: YouTubeVideoSearchResult[];
  sourcePath: string;
}) {
  if (results.length === 0) return null;

  return (
    <section className="mt-8 max-w-5xl" aria-labelledby="youtube-suggestions-title">
      <div className="mb-3">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">YouTube search</p>
        <h2 id="youtube-suggestions-title" className="mt-1 text-[18px] font-semibold text-foreground">
          Are you looking for one of these?
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          Pick the exact video and it will go into the import queue. No sign-in required.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {results.map((result) => {
          const duration = formatDuration(result.durationSeconds);
          const publishedDate = formatPublishedDate(result.publishedAt);
          return (
            <article key={result.videoId} className="overflow-hidden rounded-xl border border-border bg-card/60">
              <a href={result.youtubeUrl} target="_blank" rel="noreferrer" className="group block">
                <div className="relative aspect-video">
                  <YouTubeThumbnail
                    videoId={result.videoId}
                    alt={`${result.title} YouTube thumbnail`}
                    className="h-full w-full"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                  {duration && <span className="absolute bottom-2 right-2 rounded bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-foreground">{duration}</span>}
                </div>
              </a>
              <div className="p-4">
                <a href={result.youtubeUrl} target="_blank" rel="noreferrer" className="line-clamp-2 text-[14px] font-semibold leading-snug text-foreground transition-colors hover:text-primary">
                  {result.title}
                </a>
                <p className="mt-1.5 truncate text-[12px] text-muted-foreground">{result.channelTitle}</p>
                {publishedDate && <p className="mt-0.5 text-[11px] text-muted-foreground/75">Published {publishedDate}</p>}
                <div className="mt-4">
                  <YouTubeRequestButton
                    query={query}
                    videoId={result.videoId}
                    title={result.title}
                    channelTitle={result.channelTitle}
                    publishedAt={result.publishedAt}
                    thumbnailUrl={result.thumbnailUrl}
                    sourcePath={sourcePath}
                  />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
