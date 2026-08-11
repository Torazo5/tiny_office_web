import { StarRating } from "@/components/star-rating";
import type { RatingDistributionEntry } from "@/lib/types";

export function RatingSummary({
  average,
  ratingCount,
  reviewCount,
  distribution,
}: {
  average: number | null;
  ratingCount: number;
  reviewCount: number;
  distribution: RatingDistributionEntry[];
}) {
  const peak = Math.max(1, ...distribution.map((entry) => entry.count));
  const bars = [...distribution].reverse();

  return (
    <section aria-labelledby="ratings-heading" className="mb-5 max-w-[360px] border-y border-border py-3">
      <div className="flex items-center justify-between gap-4 border-b border-border pb-2">
        <h2 id="ratings-heading" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Ratings
        </h2>
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
          {ratingCount.toLocaleString()} {ratingCount === 1 ? "rating" : "ratings"}
        </p>
      </div>

      <div className="mt-3 flex items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex h-11 items-end gap-1" aria-label="Rating distribution from half a star to five stars">
            {bars.map((entry) => (
              <div key={entry.rating} className="flex h-full min-w-0 flex-1 items-end">
                <div
                  className="w-full rounded-t-sm bg-muted-foreground/55 transition-[height]"
                  style={{ height: entry.count === 0 ? "2px" : `${Math.max(8, (entry.count / peak) * 100)}%` }}
                  title={`${entry.rating.toFixed(1)} stars: ${entry.count}`}
                />
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {reviewCount.toLocaleString()} {reviewCount === 1 ? "review" : "reviews"}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <div className="font-mono text-[24px] font-medium leading-none text-foreground">
            {average === null ? "—" : average.toFixed(1)}
          </div>
          {average !== null && <StarRating rating={average} size="mt-2 text-[12px]" />}
        </div>
      </div>
    </section>
  );
}
