import Link from "next/link";
import { Header } from "@/components/header";
import { getReviewQueue } from "@/lib/data";

/**
 * Dense, utilitarian admin worklist — deliberately no card chrome or
 * imagery per the design handoff. This is for a small trusted team doing
 * manual confirmation passes, not a marketing surface.
 */
export default async function ReviewQueuePage() {
  const items = await getReviewQueue();

  return (
    <>
      <Header />
      <main className="p-8">
        <h1 className="text-xl font-semibold text-foreground mb-1">Review queue</h1>
        <p className="text-[13px] text-muted-foreground mb-5">
          {items.length} performances flagged for manual confirmation
        </p>

        <div className="border border-border rounded-lg overflow-hidden">
          <div
            className="grid px-4 py-2.5 bg-card font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            style={{ gridTemplateColumns: "2.2fr 0.9fr 2.3fr 0.8fr" }}
          >
            <div>Performance</div>
            <div>Confidence</div>
            <div>Why</div>
            <div />
          </div>
          {items.map((item) => (
            <Link
              key={item.videoId}
              href={`/review/${item.videoId}`}
              className="grid items-center px-4 py-3.5 border-t border-border hover:bg-secondary/50 transition-colors"
              style={{ gridTemplateColumns: "2.2fr 0.9fr 2.3fr 0.8fr" }}
            >
              <div className="text-[13.5px] font-medium text-foreground">{item.artist}</div>
              <div
                className={`font-mono text-[13px] font-semibold ${
                  item.confidencePct < 70 ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {item.confidencePct}%
              </div>
              <div className="text-[12.5px] text-muted-foreground">{item.whyText}</div>
              <div className="text-[12.5px] font-medium text-primary text-right">Review &rarr;</div>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
