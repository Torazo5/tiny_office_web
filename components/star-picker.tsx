"use client";

const STAR_COUNT = 5;

export function StarPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: number | null;
  onChange: (rating: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center" aria-label="Choose a rating from 0.5 to 5 stars">
      {Array.from({ length: STAR_COUNT }, (_, index) => {
        const starNumber = index + 1;
        const fill = value !== null && value >= starNumber
          ? "full"
          : value !== null && value >= starNumber - 0.5
            ? "half"
            : "empty";

        return (
          <span key={starNumber} className="relative inline-flex h-8 w-7 items-center justify-center">
            <span
              aria-hidden
              className={`pointer-events-none text-[22px] leading-none ${
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
            <button
              type="button"
              disabled={disabled}
              aria-label={`${starNumber - 0.5} stars`}
              onClick={() => onChange(starNumber - 0.5)}
              className="absolute inset-y-0 left-0 w-1/2 rounded-l transition-colors hover:bg-primary/10 disabled:cursor-wait"
            />
            <button
              type="button"
              disabled={disabled}
              aria-label={`${starNumber} stars`}
              onClick={() => onChange(starNumber)}
              className="absolute inset-y-0 right-0 w-1/2 rounded-r transition-colors hover:bg-primary/10 disabled:cursor-wait"
            />
          </span>
        );
      })}
      <span className="ml-2 min-w-8 font-mono text-xs text-muted-foreground">
        {value === null ? "—" : value.toFixed(1)}
      </span>
    </div>
  );
}
