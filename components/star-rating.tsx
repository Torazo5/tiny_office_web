/** Filled/empty ★ row — coral filled, muted empty, per the design handoff. Read-only display. */
export function StarRating({
  rating,
  outOf = 5,
  size = "text-sm",
}: {
  rating: number;
  outOf?: number;
  size?: string;
}) {
  const filled = Math.round(rating);
  return (
    <span className={`${size} tracking-widest`} aria-label={`${rating} out of ${outOf} stars`}>
      <span className="text-primary">{"★".repeat(filled)}</span>
      <span className="text-muted">{"★".repeat(Math.max(0, outOf - filled))}</span>
    </span>
  );
}
