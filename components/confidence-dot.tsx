import { cn } from "@/lib/utils";

/**
 * Green = verified/confirmed, coral = needs review. Same semantic dot used
 * on browse cards and song rows per the design handoff.
 */
export function ConfidenceDot({
  verified,
  className,
  size = 9,
}: {
  verified: boolean;
  className?: string;
  size?: number;
}) {
  return (
    <span
      className={cn(
        "inline-block rounded-full shrink-0",
        verified ? "bg-success" : "bg-primary",
        className,
      )}
      style={{ width: size, height: size }}
      aria-label={verified ? "Verified" : "Needs review"}
    />
  );
}
