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

  return (
    <section aria-labelledby="ratings-heading" className="mb-6 rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
        <div className="shrink-0 border-b border-border pb-5 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-8">
          <h2 id="ratings-heading" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Community rating
          </h2>
          <div className="mt-2 flex items-end gap-2">
            <span className="font-mono text-4xl font-semibold leading-none text-foreground">
              {average === null ? "—" : average.toFixed(1)}
            </span>
            <span className="mb-0.5 text-sm text-muted-foreground">/ 5</span>
          </div>
          {average !== null && <StarRating rating={average} size="mt-2 text-[17px]" />}
          <p className="mt-2 text-[12.5px] text-muted-foreground">
            {ratingCount.toLocaleString()} {ratingCount === 1 ? "rating" : "ratings"} · {reviewCount.toLocaleString()} {reviewCount === 1 ? "review" : "reviews"}
          </p>
        </div>

        <div className="min-w-0 flex-1" aria-label="Rating distribution">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Rating distribution</div>
          <div className="space-y-1.5">
            {distribution.map((entry) => (
              <div key={entry.rating} className="grid grid-cols-[38px_minmax(0,1fr)_28px] items-center gap-2 text-[11px]">
                <span className="font-mono text-muted-foreground">{entry.rating.toFixed(1)}</span>
                <div className="h-2 overflow-hidden rounded-full bg-secondary" aria-hidden>
                  <div
                    className="h-full rounded-full bg-primary transition-[width]"
                    style={{ width: `${(entry.count / peak) * 100}%` }}
                  />
                </div>
                <span className="text-right font-mono text-muted-foreground">{entry.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
