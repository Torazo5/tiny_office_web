"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePlayer } from "@/components/player-context";

type HintStep = {
  target: string;
  title: string;
  detail: string;
};

const VIDEO_STEPS: HintStep[] = [
  {
    target: "only-song-mode",
    title: "Keep it to the music",
    detail: "Only song mode skips the applause and talking between mapped songs.",
  },
  {
    target: "song-list",
    title: "Jump straight to a song",
    detail: "Every title in this set is clickable. Pick one to move the player right to that song.",
  },
  {
    target: "playback-settings",
    title: "Make transitions yours",
    detail: "Adjust the silence and fades between songs whenever you want a smoother—or roomier—listen.",
  },
  {
    target: "timeline-editor",
    title: "Help tune the timeline",
    detail: "If a song starts or ends in the wrong place, open the editor to suggest a correction.",
  },
];

const TIMELINE_STEPS: HintStep[] = [
  {
    target: "timeline-song-picker",
    title: "Work one song at a time",
    detail: "Choose a song here. The player and timestamps below always follow that selection.",
  },
  {
    target: "timeline-playback",
    title: "Listen before changing it",
    detail: "Play the selected clip, then use the scrubber to check where the music really begins and ends.",
  },
  {
    target: "timeline-boundaries",
    title: "Adjust the boundaries",
    detail: "Edit the two timestamps directly or use the small ±5 second nudges. You can submit your correction when it feels right.",
  },
];

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("tiny-office:feature-hints", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("tiny-office:feature-hints", onStoreChange);
  };
}

function isComplete(storageKey: string) {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(storageKey) === "complete";
  } catch {
    return true;
  }
}

function GuidedHints({
  storageKey,
  steps,
  beforeStepChange,
}: {
  storageKey: string;
  steps: HintStep[];
  beforeStepChange?: (nextStep: number) => void;
}) {
  const complete = useSyncExternalStore(
    subscribe,
    () => isComplete(storageKey),
    () => true,
  );
  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex];

  useEffect(() => {
    if (complete || !step) return;
    const target = document.querySelector<HTMLElement>(`[data-feature-hint="${step.target}"]`);
    if (!target) return;

    target.classList.add("ring-2", "ring-primary", "ring-offset-2", "ring-offset-background");
    target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    return () => target.classList.remove("ring-2", "ring-primary", "ring-offset-2", "ring-offset-background");
  }, [complete, step]);

  if (complete || !step) return null;

  function finish() {
    try {
      window.localStorage.setItem(storageKey, "complete");
      window.dispatchEvent(new Event("tiny-office:feature-hints"));
    } catch {
      // The guide is a convenience; it should quietly disappear if storage is unavailable.
    }
  }

  function next() {
    const nextStep = stepIndex + 1;
    if (nextStep >= steps.length) {
      finish();
      return;
    }
    beforeStepChange?.(nextStep);
    setStepIndex(nextStep);
  }

  return (
    <aside
      className="fixed bottom-4 right-4 z-40 w-[calc(100%-2rem)] max-w-sm rounded-xl border border-primary/35 bg-card p-4 shadow-2xl"
      aria-live="polite"
      aria-label={`Feature hint ${stepIndex + 1} of ${steps.length}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
          A quick note · {stepIndex + 1}/{steps.length}
        </span>
        <button type="button" onClick={finish} className="text-[11.5px] text-muted-foreground hover:text-foreground">
          Skip tips
        </button>
      </div>
      <h2 className="mt-2 text-sm font-semibold text-foreground">{step.title}</h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{step.detail}</p>
      <div className="mt-4 flex justify-end">
        <button type="button" onClick={next} className="rounded-lg bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground">
          {stepIndex === steps.length - 1 ? "Done" : "Next tip"}
        </button>
      </div>
    </aside>
  );
}

export function VideoFeatureHints() {
  const { hasStartedPlayback, setOnlySongMode } = usePlayer();

  if (!hasStartedPlayback) return null;

  return (
    <GuidedHints
      storageKey="tiny-office:feature-hints:video"
      steps={VIDEO_STEPS}
      beforeStepChange={(nextStep) => {
        // Playback settings live behind only-song mode, so reveal them as the
        // visitor explicitly advances to that note instead of leaving a dead target.
        if (nextStep === 2) setOnlySongMode(true);
      }}
    />
  );
}

export function TimelineFeatureHints() {
  return <GuidedHints storageKey="tiny-office:feature-hints:timeline" steps={TIMELINE_STEPS} />;
}
