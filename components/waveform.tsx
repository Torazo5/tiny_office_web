/**
 * Static placeholder waveform — there's no real waveform/amplitude data in
 * the pipeline output (reports/<id>.json has no such field), so bar
 * heights are a deterministic decorative pattern, not real audio analysis.
 * Codex should replace this with real waveform data once that exists
 * (e.g. computed from reports/audio/<id>.mp3).
 *
 * What IS real: the clip-range highlight position, derived from the
 * song's actual clip_start/clip_end against the performance's duration.
 */
export function Waveform({
  durationSec,
  clipStart,
  clipEnd,
}: {
  durationSec: number;
  clipStart: number;
  clipEnd: number;
}) {
  const bars = Array.from({ length: 48 }, (_, i) => {
    const h = Math.round(14 + 20 * Math.abs(Math.sin(i * 0.7)) + (i % 5) * 2);
    const pct = (i / 48) * 100;
    const startPct = (clipStart / durationSec) * 100;
    const endPct = (clipEnd / durationSec) * 100;
    const inClip = pct >= startPct && pct <= endPct;
    return { h, inClip };
  });

  const startPct = Math.max(0, (clipStart / durationSec) * 100);
  const widthPct = Math.max(0, ((clipEnd - clipStart) / durationSec) * 100);

  return (
    <div>
      <div className="relative h-16 flex items-center gap-0.5 mb-2">
        {bars.map((bar, i) => (
          <div
            key={i}
            className={`w-full rounded-[1px] ${bar.inClip ? "bg-primary" : "bg-muted"}`}
            style={{ height: bar.h }}
          />
        ))}
      </div>
      <div className="relative h-0.5 bg-input rounded-full">
        <div
          className="absolute -top-[3px] h-2 rounded border border-primary bg-primary/25"
          style={{ left: `${startPct}%`, width: `${widthPct}%` }}
        />
      </div>
    </div>
  );
}
