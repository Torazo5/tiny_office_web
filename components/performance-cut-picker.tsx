import type { PerformanceCutKey, PerformanceCutVariant } from "@/lib/types";

export function PerformanceCutPicker({
  videoId,
  variants,
  selectedCutKey,
}: {
  videoId: string;
  variants: PerformanceCutVariant[];
  selectedCutKey: PerformanceCutKey | null;
}) {
  if (variants.length < 2) return null;

  const selectedVariant = variants.find((variant) => variant.key === selectedCutKey) ?? variants[0];

  return (
    <div className="mb-5 rounded-lg border border-border bg-card/60 p-3.5">
      <div className="mb-2">
        <div className="text-[13px] font-semibold text-foreground">Playback cut</div>
        <p className="text-[11.5px] text-muted-foreground">
          Choose the default tight cut or keep more of the room response.
        </p>
      </div>
      <form action={`/video/${videoId}`} method="get" className="flex flex-wrap items-center gap-2">
        <select
          name="cut"
          defaultValue={selectedVariant.key}
          className="h-9 min-w-[240px] flex-1 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {variants.map((variant) => (
            <option key={variant.key} value={variant.key}>
              {variant.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg border border-input px-3.5 py-2 text-[12.5px] font-medium text-muted-foreground hover:text-foreground"
        >
          Apply cut
        </button>
      </form>
      <p className="mt-2 text-[11.5px] text-muted-foreground">{selectedVariant.description}</p>
    </div>
  );
}
