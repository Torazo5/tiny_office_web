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

const ADVENTURE_SETUP_STEPS: HintStep[] = [
  {
    target: "adventure-options",
    title: "Choose your kind of discovery",
    detail: "Pick individual songs for quick surprises, or full videos for a whole performance at a time.",
  },
  {
    target: "adventure-start",
    title: "Start a fresh queue",
    detail: "This creates a new shuffled run. Nothing is permanent, so you can change it up whenever you want.",
  },
];

const ADVENTURE_PLAY_STEPS: HintStep[] = [
  {
    target: "adventure-play",
    title: "Your first pick is ready",
    detail: "Press play to start listening. The queue will keep the next pick ready for you.",
  },
  {
    target: "playback-settings",
    title: "Set the handoff between songs",
    detail: "Customize the gap and fades here whenever you want to tune the queue—or give each song a little breathing room.",
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
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const step = steps[stepIndex];

  useEffect(() => {
    if (complete || !step) {
      const resetFrame = window.requestAnimationFrame(() => setTargetRect(null));
      return () => window.cancelAnimationFrame(resetFrame);
    }
    const target = document.querySelector<HTMLElement>(`[data-feature-hint="${step.target}"]`);
    if (!target) return;

    let frameId: number | null = null;
    const updateTargetRect = () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => setTargetRect(target.getBoundingClientRect()));
    };

    target.classList.add(
      "relative",
      "z-[60]",
      "rounded-lg",
      "ring-4",
      "ring-primary",
      "ring-offset-4",
      "ring-offset-background",
      "shadow-[0_0_38px_oklch(0.68_0.17_25_/_0.45)]",
    );
    target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    updateTargetRect();
    window.addEventListener("resize", updateTargetRect);
    window.addEventListener("scroll", updateTargetRect, true);

    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updateTargetRect);
      window.removeEventListener("scroll", updateTargetRect, true);
      target.classList.remove(
        "relative",
        "z-[60]",
        "rounded-lg",
        "ring-4",
        "ring-primary",
        "ring-offset-4",
        "ring-offset-background",
        "shadow-[0_0_38px_oklch(0.68_0.17_25_/_0.45)]",
      );
    };
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

  const cardWidth = typeof window === "undefined" ? 360 : Math.min(360, window.innerWidth - 32);
  const cardLeft = targetRect
    ? Math.min(Math.max(16, targetRect.left), window.innerWidth - cardWidth - 16)
    : 16;
  const cardAboveTarget = targetRect && targetRect.bottom + 210 > window.innerHeight - 16;
  const cardTop = targetRect
    ? cardAboveTarget
      ? Math.max(16, targetRect.top - 202)
      : Math.min(targetRect.bottom + 18, window.innerHeight - 190)
    : 16;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[1px]" aria-hidden="true" />
      <aside
        className="fixed z-[70] w-[calc(100%-2rem)] rounded-xl border border-primary/50 bg-card p-4 shadow-2xl"
        style={{ width: cardWidth, left: cardLeft, top: cardTop }}
        aria-live="polite"
        aria-label={`Feature hint ${stepIndex + 1} of ${steps.length}`}
      >
        {targetRect && (
          <span
            aria-hidden="true"
            className={`absolute left-7 h-3 w-3 rotate-45 border-primary bg-card ${
              cardAboveTarget ? "-bottom-1.5 border-b border-r" : "-top-1.5 border-l border-t"
            }`}
          />
        )}
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
    </>
  );
}

export function VideoFeatureHints() {
  const { setOnlySongMode } = usePlayer();

  return (
    <GuidedHints
      storageKey="tiny-office:feature-hints:video-spotlight-v2"
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

export function AdventureSetupFeatureHints() {
  return <GuidedHints storageKey="tiny-office:feature-hints:adventure-setup" steps={ADVENTURE_SETUP_STEPS} />;
}

export function AdventurePlayFeatureHints() {
  return <GuidedHints storageKey="tiny-office:feature-hints:adventure-play-spotlight-v2" steps={ADVENTURE_PLAY_STEPS} />;
}
