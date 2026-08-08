"use client";

import Link from "next/link";
import { useMemo, useState, useActionState } from "react";
import { Waveform } from "@/components/waveform";
import { RevisionVideoPlayer } from "@/components/revision-video-player";
import {
  resolveTruthRequest,
  saveGroundTruthAction,
  submitListeningPreset,
  submitTruthRequest,
  type ReviewActionState,
} from "@/app/review/actions";
import type { Performance, TimelineDraftSong, TruthRequestSummary } from "@/lib/types";
import {
  createTimelineDraft,
  formatTimeInput,
  parseTimeInput,
  TIMELINE_NUDGE_SECONDS,
} from "@/lib/review-utils";
import { formatTime } from "@/lib/format";

type EditableSong = {
  index: number;
  title: string;
  baseStart: number;
  baseEnd: number;
  clipStart: string;
  clipEnd: string;
};

function toEditableSongs(performance: Performance, initialDraft?: TimelineDraftSong[]) {
  const draftByIndex = new Map((initialDraft ?? createTimelineDraft(performance.songs)).map((song) => [song.songIndex, song]));
  return performance.songs.map((song) => {
    const draft = draftByIndex.get(song.index);
    return {
      index: song.index,
      title: song.title,
      baseStart: song.clipStart,
      baseEnd: song.clipEnd,
      clipStart: formatTimeInput(draft?.clipStart ?? song.clipStart),
      clipEnd: formatTimeInput(draft?.clipEnd ?? song.clipEnd),
    } satisfies EditableSong;
  });
}

function actionMessage(...states: Array<ReviewActionState>) {
  return states.find((state) => state?.error || state?.success) ?? null;
}

export function RevisionEditor({
  performance,
  isSignedIn,
  isAdmin,
  request,
  initialDraft,
}: {
  performance: Performance;
  isSignedIn: boolean;
  isAdmin: boolean;
  request?: TruthRequestSummary | null;
  initialDraft?: TimelineDraftSong[];
}) {
  const [songs, setSongs] = useState(() => toEditableSongs(performance, initialDraft));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [presetState, presetAction, presetPending] = useActionState<ReviewActionState, FormData>(submitListeningPreset, null);
  const [truthState, truthAction, truthPending] = useActionState<ReviewActionState, FormData>(submitTruthRequest, null);
  const [saveState, saveAction, savePending] = useActionState<ReviewActionState, FormData>(saveGroundTruthAction, null);
  const [resolveState, resolveAction, resolvePending] = useActionState<ReviewActionState, FormData>(resolveTruthRequest, null);

  const song = songs[currentIndex] ?? songs[0];
  const currentStart = parseTimeInput(song?.clipStart ?? "") ?? song?.baseStart ?? 0;
  const currentEnd = parseTimeInput(song?.clipEnd ?? "") ?? song?.baseEnd ?? 0;
  const draft = useMemo<TimelineDraftSong[]>(
    () => songs.map((item) => ({
      songIndex: item.index,
      clipStart: parseTimeInput(item.clipStart) ?? Number.NaN,
      clipEnd: parseTimeInput(item.clipEnd) ?? Number.NaN,
    })),
    [songs],
  );
  const draftJson = JSON.stringify(draft);
  const message = actionMessage(presetState, truthState, saveState, resolveState);
  const isPending = presetPending || truthPending || savePending || resolvePending;

  function updateSong(index: number, field: "clipStart" | "clipEnd", value: string) {
    setSongs((current) => current.map((item) => item.index === index ? { ...item, [field]: value } : item));
  }

  function nudge(field: "clipStart" | "clipEnd", delta: number) {
    if (!song) return;
    const value = Math.max(0, Math.min(performance.duration, (field === "clipStart" ? currentStart : currentEnd) + delta));
    updateSong(song.index, field, formatTimeInput(value));
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{performance.artist}</h1>
          <p className="text-[13px] text-muted-foreground">
            {isAdmin
              ? request
                ? `Reviewing a main-truth request from ${request.requesterName}`
                : "Editing main truth directly"
              : "Edit the timeline, then publish a preset or request a main-truth update."}
          </p>
        </div>
        <Link
          href={isAdmin ? "/review" : `/video/${performance.videoId}`}
          className="rounded-lg border border-border px-3.5 py-2 text-[12.5px] font-medium text-muted-foreground hover:text-foreground"
        >
          {isAdmin ? "Admin dashboard" : "Back to performance"}
        </Link>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto border-b border-border pb-2">
        {songs.map((item, index) => {
          const changed = item.clipStart !== formatTimeInput(item.baseStart) || item.clipEnd !== formatTimeInput(item.baseEnd);
          return (
            <button
              key={item.index}
              type="button"
              onClick={() => setCurrentIndex(index)}
              className={`shrink-0 rounded-lg px-3 py-2 text-left text-[12px] ${
                index === currentIndex ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60"
              }`}
            >
              <span className="font-mono">{item.index}</span> {item.title}
              {changed && <span className="ml-1 text-primary">●</span>}
            </button>
          );
        })}
      </div>

      {song && (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
          <RevisionVideoPlayer
            videoId={performance.videoId}
            songKey={`${performance.videoId}:${song.index}`}
            songTitle={song.title}
            clipStart={currentStart}
            clipEnd={currentEnd}
            duration={performance.duration}
          />

          <div className="rounded-[10px] border border-border bg-card p-5">
            <div className="text-[15px] font-semibold text-foreground mb-0.5">{song.title}</div>
            <div className="font-mono text-xs text-muted-foreground mb-4.5">
              current clip {formatTime(currentStart)} &ndash; {formatTime(currentEnd)}
            </div>

            <Waveform durationSec={performance.duration} clipStart={currentStart} clipEnd={currentEnd} />
            <div className="flex justify-between mt-1.5 font-mono text-[11px] text-muted-foreground/70">
              <span>0:00</span>
              <span>{formatTime(performance.duration)}</span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="text-[12px] font-medium text-muted-foreground">
                Start time
                <input
                  value={song.clipStart}
                  onChange={(event) => updateSong(song.index, "clipStart", event.target.value)}
                  inputMode="decimal"
                  aria-label={`${song.title} start time`}
                  className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-2.5 font-mono text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </label>
              <label className="text-[12px] font-medium text-muted-foreground">
                End time
                <input
                  value={song.clipEnd}
                  onChange={(event) => updateSong(song.index, "clipEnd", event.target.value)}
                  inputMode="decimal"
                  aria-label={`${song.title} end time`}
                  className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-2.5 font-mono text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => nudge("clipStart", -TIMELINE_NUDGE_SECONDS)} className="rounded-lg border border-input px-3 py-2 text-[12px] text-muted-foreground hover:text-foreground">Start −5s</button>
              <button type="button" onClick={() => nudge("clipStart", TIMELINE_NUDGE_SECONDS)} className="rounded-lg border border-input px-3 py-2 text-[12px] text-muted-foreground hover:text-foreground">Start +5s</button>
              <button type="button" onClick={() => nudge("clipEnd", -TIMELINE_NUDGE_SECONDS)} className="rounded-lg border border-input px-3 py-2 text-[12px] text-muted-foreground hover:text-foreground">End −5s</button>
              <button type="button" onClick={() => nudge("clipEnd", TIMELINE_NUDGE_SECONDS)} className="rounded-lg border border-input px-3 py-2 text-[12px] text-muted-foreground hover:text-foreground">End +5s</button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex justify-between">
        <button type="button" onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))} disabled={currentIndex === 0} className="rounded-lg border border-border px-3.5 py-2 text-[13px] text-muted-foreground disabled:opacity-40">← Previous song</button>
        <button type="button" onClick={() => setCurrentIndex(Math.min(songs.length - 1, currentIndex + 1))} disabled={currentIndex === songs.length - 1} className="rounded-lg border border-border px-3.5 py-2 text-[13px] text-muted-foreground disabled:opacity-40">Next song →</button>
      </div>

      <form className="mt-5 border-t border-border pt-5">
        <input type="hidden" name="performance_video_id" value={performance.videoId} />
        <input type="hidden" name="draft" value={draftJson} />
        {request && <input type="hidden" name="request_id" value={request.id} />}

        <div className="grid gap-3 sm:grid-cols-2">
          {!isAdmin && (
            <label className="text-[12px] font-medium text-muted-foreground">
              Preset name
              <input name="preset_name" placeholder="My extended endings" maxLength={80} className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
            </label>
          )}
          <label className="text-[12px] font-medium text-muted-foreground">
            {isAdmin ? "Resolution note" : "Note (optional)"}
            <input name={isAdmin ? "resolution_note" : "note"} maxLength={1000} placeholder={isAdmin ? "What changed?" : "Why this timeline works for you"} className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
          </label>
        </div>

        {!isAdmin && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {isSignedIn ? (
              <>
                <button formAction={presetAction} type="submit" disabled={isPending} className="rounded-lg border border-input px-3.5 py-2 text-[13px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-60">{presetPending ? "Publishing…" : "Publish listening preset"}</button>
                <button formAction={truthAction} type="submit" disabled={isPending} className="rounded-lg bg-primary px-3.5 py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-60">{truthPending ? "Sending…" : "Submit for main truth"}</button>
              </>
            ) : (
              <Link href={`/login?next=${encodeURIComponent(`/review/${performance.videoId}`)}`} className="rounded-lg bg-primary px-3.5 py-2 text-[13px] font-semibold text-primary-foreground">Sign in to submit</Link>
            )}
          </div>
        )}

        {isAdmin && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {request ? (
              request.status === "pending" ? (
                <>
                  <button formAction={resolveAction} type="submit" name="decision" value="approve" disabled={isPending} className="rounded-lg bg-primary px-3.5 py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-60">{resolvePending ? "Applying…" : "Apply as main truth"}</button>
                  <button formAction={resolveAction} type="submit" name="decision" value="reject" disabled={isPending} className="rounded-lg border border-primary/50 px-3.5 py-2 text-[13px] font-medium text-primary disabled:opacity-60">Reject request</button>
                </>
              ) : (
                <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Request already {request.status}</span>
              )
            ) : (
              <button formAction={saveAction} type="submit" disabled={isPending} className="rounded-lg bg-primary px-3.5 py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-60">{savePending ? "Saving…" : "Save as main truth"}</button>
            )}
          </div>
        )}
        {message?.error && <p className="mt-3 text-sm text-primary">{message.error}</p>}
        {message?.success && <p className="mt-3 text-sm text-success">{message.success}</p>}
      </form>

      {!isAdmin && (
        <div className="mt-8 border-t border-border pt-4">
          <div className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Admin access</div>
          <p className="mt-1 text-[12px] text-muted-foreground">Admins can review requests and update main truth from the dashboard.</p>
          <Link href={`/review/${performance.videoId}?admin=1`} className="mt-2 inline-block text-[12.5px] font-medium text-primary hover:underline">I am an admin →</Link>
        </div>
      )}
    </div>
  );
}
