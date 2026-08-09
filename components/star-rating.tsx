/** Read-only ★ row with half-star rendering for ratings in 0.5 increments. */
export function StarRating({
  rating,
  outOf = 5,
  size = "text-sm",
}: {
  rating: number;
  outOf?: number;
  size?: string;
}) {
  return (
    <span className={`${size} inline-flex`} aria-label={`${rating} out of ${outOf} stars`}>
      {Array.from({ length: outOf }, (_, index) => {
        const starNumber = index + 1;
        const fill = rating >= starNumber ? "full" : rating >= starNumber - 0.5 ? "half" : "empty";
        return (
          <span
            key={starNumber}
            aria-hidden
            className={`leading-none ${
                fill === "full"
                  ? "text-primary"
                  : fill === "half"
                  ? "bg-clip-text text-transparent"
                  : "text-muted"
            }`}
            style={fill === "half" ? {
              backgroundImage: "linear-gradient(to right, var(--primary) 50%, var(--muted) 50%)",
            } : undefined}
          >
            ★
          </span>
        );
      })}
    </span>
  );
}
