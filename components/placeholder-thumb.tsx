import { cn } from "@/lib/utils";

/**
 * Diagonal-stripe placeholder — stands in for real YouTube thumbnails /
 * user-generated cover art, per the design handoff's "Assets" section.
 */
export function PlaceholderThumb({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-[repeating-linear-gradient(135deg,var(--muted)_0,var(--muted)_10px,var(--secondary)_10px,var(--secondary)_20px)]",
        className,
      )}
    >
      <span className="font-mono text-[10px] tracking-wide text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
