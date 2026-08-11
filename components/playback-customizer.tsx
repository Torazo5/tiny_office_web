"use client";

import { useState, useTransition } from "react";
import { savePlaybackDefaults } from "@/app/profile/actions";
import {
  PLAYBACK_PRESETS,
  normalizePlaybackSettings,
  type PlaybackSettings,
} from "@/lib/playback-settings";

function secondsLabel(value: number) {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}s`;
}

export function PlaybackCustomizer({
  settings,
  onSettingsChange,
  isSignedIn,
}: {
  settings: PlaybackSettings;
  onSettingsChange: (settings: PlaybackSettings) => void;
  isSignedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [confirmDefault, setConfirmDefault] = useState(false);
  const [draft, setDraft] = useState(settings);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  function apply() {
    const next = normalizePlaybackSettings(draft);
    onSettingsChange(next);
    if (isSignedIn) setConfirmDefault(true);
    else {
      setOpen(false);
      setMessage("Applied for this session.");
    }
  }

  function close() {
    setOpen(false);
    setConfirmDefault(false);
  }

  function saveAsDefault() {
    const next = normalizePlaybackSettings(draft);
    close();
    startSaving(async () => {
      const result = await savePlaybackDefaults(next);
      if ("error" in result) {
        setMessage(result.error ?? "Could not save playback defaults. Try again.");
        return;
      }
      setMessage("Applied and saved as your account default.");
    });
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-secondary/25 px-3 py-2.5">
        <div>
          <div className="text-[12px] font-medium text-foreground">Transitions</div>
          <p className="text-[11px] text-muted-foreground">
            {secondsLabel(settings.gapSeconds)} gap · {secondsLabel(settings.fadeOutSeconds)} out · {secondsLabel(settings.fadeInSeconds)} in
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setDraft(settings);
            setConfirmDefault(false);
            setOpen(true);
          }}
          className="rounded-md border border-input bg-background px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Customize playback
        </button>
      </div>
      {message && <p className="mt-2 text-[11.5px] text-success">{message}</p>}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-3 sm:items-center sm:justify-center" role="presentation">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="playback-customizer-title"
            className="max-h-[calc(100vh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-2xl sm:p-5"
          >
            {confirmDefault ? (
              <div>
                <h2 id="playback-customizer-title" className="text-base font-semibold text-foreground">Make this your default?</h2>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                  These settings are already applied here. Save them to your account to start every playlist, adventure, and song-only video this way.
                </p>
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={close} className="rounded-lg border border-input px-3 py-2 text-[12.5px] font-medium text-muted-foreground hover:text-foreground">
                    Keep for now
                  </button>
                  <button type="button" onClick={saveAsDefault} disabled={isSaving} className="rounded-lg bg-primary px-3 py-2 text-[12.5px] font-semibold text-primary-foreground disabled:opacity-60">
                    {isSaving ? "Saving…" : "Save as default"}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 id="playback-customizer-title" className="text-base font-semibold text-foreground">Customize playback</h2>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">Fade-out finishes at a song&apos;s end; fade-in begins at the next song&apos;s start.</p>
                  </div>
                  <button type="button" onClick={close} className="rounded-md px-2 py-1 text-[12px] text-muted-foreground hover:text-foreground" aria-label="Close playback customization">Close</button>
                </div>
                <div className="mt-5 grid gap-2 sm:grid-cols-3">
                  {PLAYBACK_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setDraft(preset.settings)}
                      className="rounded-lg border border-input bg-secondary/30 p-3 text-left transition-colors hover:border-primary/50"
                    >
                      <span className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
                        {preset.name}
                        {preset.id === "seamless" && (
                          <span className="rounded-full bg-primary/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-primary">Recommended</span>
                        )}
                      </span>
                      <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">{preset.description}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  {([
                    ["gapSeconds", "Silent gap"],
                    ["fadeOutSeconds", "Fade out"],
                    ["fadeInSeconds", "Fade in"],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="block text-[12px] font-medium text-foreground">
                      {label}
                      <div className="mt-1.5 flex items-center rounded-lg border border-input bg-secondary px-2.5 focus-within:border-primary">
                        <input
                          type="number"
                          min="0"
                          max="10"
                          step="0.1"
                          value={draft[key]}
                          onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.valueAsNumber }))}
                          className="h-9 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
                        />
                        <span className="text-[11px] text-muted-foreground">sec</span>
                      </div>
                    </label>
                  ))}
                </div>
                <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-lg border border-input bg-secondary/30 p-3">
                  <input type="checkbox" checked={draft.cutAudience} onChange={(event) => setDraft((current) => ({ ...current, cutAudience: event.target.checked }))} className="mt-0.5 accent-primary" />
                  <span>
                    <span className="block text-[12.5px] font-medium text-foreground">Cut audience between songs</span>
                    <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted-foreground">Use mapped song boundaries to skip applause and spoken interludes. It applies wherever the performance has song timing.</span>
                  </span>
                </label>
                <div className="mt-5 flex justify-end gap-2">
                  <button type="button" onClick={close} className="rounded-lg border border-input px-3 py-2 text-[12.5px] font-medium text-muted-foreground hover:text-foreground">Cancel</button>
                  <button type="button" onClick={apply} className="rounded-lg bg-primary px-3 py-2 text-[12.5px] font-semibold text-primary-foreground">Apply</button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
