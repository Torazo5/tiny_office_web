"use client";

import { Volume1, Volume2, VolumeX } from "lucide-react";

function clampVolume(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function VolumeMeter({
  value,
  onChange,
  disabled = false,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const volume = clampVolume(value);
  const VolumeIcon = volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;

  return (
    <div className="flex items-center gap-2.5" aria-label="Volume meter">
      <VolumeIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <label className="flex min-w-0 flex-1 items-center gap-2">
        <span className="sr-only">Volume</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={volume}
          onChange={(event) => onChange(Number(event.target.value))}
          disabled={disabled}
          className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-secondary accent-primary disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            background: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${volume}%, var(--secondary) ${volume}%, var(--secondary) 100%)`,
          }}
          aria-label={`Volume ${volume}%`}
        />
        <output className="w-8 text-right font-mono text-[11px] text-muted-foreground">{volume}%</output>
      </label>
    </div>
  );
}
