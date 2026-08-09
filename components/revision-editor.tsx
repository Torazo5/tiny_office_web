"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useActionState } from "react";
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
  baseTitle: string;
  baseStart: number;
  baseEnd: number;
  baseConfirmed: boolean;
  clipStart: string;
  clipEnd: string;
  confirmed: boolean;
  isNew: boolean;
  removed: boolean;
};

function toEditableSongs(performance: Performance, initialDraft?: TimelineDraftSong[]) {
  const draft = initialDraft ?? createTimelineDraft(performance.songs);
  const draftByIndex = new Map(draft.map((song) => [song.songIndex, song]));
  const songs = performance.songs.map((song) => {
    const draft = draftByIndex.get(song.index);
    return {
      index: song.index,
      title: draft?.title ?? song.title,
      baseTitle: song.title,
      baseStart: draft?.clipStart ?? song.clipStart,
      baseEnd: draft?.clipEnd ?? song.clipEnd,
      baseConfirmed: draft?.confirmed ?? !song.suspect,
      clipStart: formatTimeInput(draft?.clipStart ?? song.clipStart),
      clipEnd: formatTimeInput(draft?.clipEnd ?? song.clipEnd),
      confirmed: draft?.confirmed ?? !song.suspect,
      isNew: false,
      removed: Boolean(initialDraft && !draft),
    } satisfies EditableSong;
  });

  return [
    ...songs,
    ...draft
      .filter((song) => !performance.songs.some((candidate) => candidate.index === song.songIndex))
      .map((song) => ({
        index: song.songIndex,
        title: song.title,
        baseTitle: song.title,
        baseStart: song.clipStart,
        baseEnd: song.clipEnd,
        baseConfirmed: song.confirmed,
        clipStart: formatTimeInput(song.clipStart),
        clipEnd: formatTimeInput(song.clipEnd),
        confirmed: song.confirmed,
        isNew: true,
        removed: false,
      } satisfies EditableSong)),
  ];
}

function actionMessage(...states: Array<ReviewActionState>) {
  return states.find((state) => state?.error || state?.success) ?? null;
}

function formatSignedTime(delta: number) {
  const rounded = Math.round(delta);
  if (rounded === 0) return "no change";
  return `${rounded > 0 ? "+" : "−"}${formatTime(Math.abs(rounded))}`;
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
  const resolveDecisionRef = useRef<HTMLInputElement>(null);

  const song = songs[currentIndex] ?? songs[0];
  const currentStart = parseTimeInput(song?.clipStart ?? "") ?? song?.baseStart ?? 0;
  const currentEnd = parseTimeInput(song?.clipEnd ?? "") ?? song?.baseEnd ?? 0;
  const draft = useMemo<TimelineDraftSong[]>(
    () => songs.filter((item) => !item.removed).map((item) => ({
      songIndex: item.index,
      title: item.title.trim(),
      clipStart: parseTimeInput(item.clipStart) ?? Number.NaN,
      clipEnd: parseTimeInput(item.clipEnd) ?? Number.NaN,
      confirmed: item.confirmed,
    })),
    [songs],
  );
  const draftJson = JSON.stringify(draft);
  const message = actionMessage(presetState, truthState, saveState, resolveState);
  const isPending = presetPending || truthPending || savePending || resolvePending;
  const requestComparison = useMemo(() => {
    if (!request) return null;
    const draftByIndex = new Map(draft.map((item) => [item.songIndex, item]));
    const groundTruthByIndex = new Map(performance.songs.map((item) => [item.index, item]));
    const indices = [...new Set([...performance.songs.map((item) => item.index), ...draft.map((item) => item.songIndex)])].sort((a, b) => a - b);
    return indices.map((index) => {
      const groundTruthSong = groundTruthByIndex.get(index);
      const proposed = draftByIndex.get(index);
      const currentStart = groundTruthSong?.clipStart ?? null;
      const currentEnd = groundTruthSong?.clipEnd ?? null;
      const proposedStart = proposed && Number.isFinite(proposed.clipStart) ? proposed.clipStart : null;
      const proposedEnd = proposed && Number.isFinite(proposed.clipEnd) ? proposed.clipEnd : null;
      const currentConfirmed = groundTruthSong ? !groundTruthSong.suspect : null;
      const proposedConfirmed = proposed?.confirmed ?? null;
      return {
        index,
        currentTitle: groundTruthSong?.title ?? null,
        proposedTitle: proposed?.title ?? null,
        currentStart,
        currentEnd,
        proposedStart,
        proposedEnd,
        currentConfirmed,
        proposedConfirmed,
        changed:
          Boolean(groundTruthSong) !== Boolean(proposed) ||
          groundTruthSong?.title !== proposed?.title ||
          currentStart !== proposedStart ||
          currentEnd !== proposedEnd ||
          currentConfirmed !== proposedConfirmed,
      };
    });
  }, [draft, performance.songs, request]);
  const changedRequestCount = requestComparison?.filter((item) => item.changed).length ?? 0;

  function updateSong(index: number, field: "clipStart" | "clipEnd", value: string) {
    setSongs((current) => current.map((item) => item.index === index ? { ...item, [field]: value } : item));
  }

  function updateTitle(index: number, title: string) {
    setSongs((current) => current.map((item) => item.index === index ? { ...item, title } : item));
  }

  function updateConfirmation(index: number, confirmed: boolean) {
    setSongs((current) => current.map((item) => item.index === index ? { ...item, confirmed } : item));
  }

  function addSong() {
    const existingIndexes = songs.map((item) => item.index);
    const nextIndex = Math.max(0, ...existingIndexes, ...performance.songs.map((item) => item.index)) + 1;
    const source = song && !song.removed ? song : songs.find((item) => !item.removed);
    const start = source ? parseTimeInput(source.clipStart) ?? source.baseStart : 0;
    const end = source ? parseTimeInput(source.clipEnd) ?? source.baseEnd : performance.duration;
    setSongs((current) => [
      ...current,
      {
        index: nextIndex,
        title: "New song",
        baseTitle: "New song",
        baseStart: start,
        baseEnd: Math.max(start + 1, end),
        baseConfirmed: false,
        clipStart: formatTimeInput(start),
        clipEnd: formatTimeInput(Math.max(start + 1, end)),
        confirmed: false,
        isNew: true,
        removed: false,
      },
    ]);
    setCurrentIndex(songs.length);
  }

  function setSongRemoved(index: number, removed: boolean) {
    setSongs((current) => current.map((item) => item.index === index ? { ...item, removed } : item));
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

      <div className="mb-4 flex justify-end">
        <div className="group relative">
          <button
            type="button"
            onClick={addSong}
            className="rounded-lg border border-primary/40 bg-primary/5 px-3.5 py-2 text-[12.5px] font-semibold text-primary hover:bg-primary/10"
            aria-describedby="add-song-hint"
          >
            + Add song
          </button>
          <div
            id="add-song-hint"
            role="tooltip"
            className="pointer-events-none absolute right-0 top-full z-10 mt-2 w-64 rounded-lg border border-border bg-card p-3 text-[11.5px] leading-relaxed text-muted-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
          >
            Want to split a song? Add a song, then adjust its timestamps to define the two parts.
          </div>
        </div>
      </div>

      {isAdmin && requestComparison && (
        <section className="mb-5 overflow-hidden rounded-[10px] border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Request comparison</h2>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Current ground truth versus the requested timeline. You can edit the proposed values below before applying them.
                </p>
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">
                {changedRequestCount} of {requestComparison.length} changed
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left">
              <thead className="bg-background/50 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Song</th>
                  <th className="px-4 py-2.5 font-semibold">Current ground truth</th>
                  <th className="px-4 py-2.5 font-semibold">Request / proposed</th>
                  <th className="px-4 py-2.5 font-semibold">Difference</th>
                </tr>
              </thead>
              <tbody>
                {requestComparison.map((item) => (
                  <tr key={item.index} className={`border-t border-border ${item.changed ? "bg-primary/[0.04]" : ""}`}>
                    <td className="px-4 py-3 align-top">
                      <div className="font-mono text-[11px] text-muted-foreground">{item.index}</div>
                      <div className={`mt-0.5 max-w-[190px] text-[12.5px] font-medium ${!item.proposedTitle ? "text-muted-foreground line-through" : !item.currentTitle ? "text-primary" : "text-foreground"}`}>
                        {item.proposedTitle ?? item.currentTitle ?? "Untitled song"}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top font-mono text-[11px] text-muted-foreground">
                      {item.currentStart !== null && item.currentEnd !== null ? (
                        <>
                          <div>{formatTime(item.currentStart)} → {formatTime(item.currentEnd)}</div>
                          <div className={`mt-1 font-sans text-[11px] ${item.currentConfirmed ? "text-success" : "text-primary"}`}>
                            {item.currentConfirmed ? "Confirmed" : "Unconfirmed"}
                          </div>
                        </>
                      ) : (
                        <span className="font-sans text-[11px] text-primary">Added in request</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top font-mono text-[11px] text-foreground">
                      {item.proposedStart !== null && item.proposedEnd !== null ? (
                        <>
                          <div>{formatTime(item.proposedStart)} → {formatTime(item.proposedEnd)}</div>
                          <div className={`mt-1 font-sans text-[11px] ${item.proposedConfirmed ? "text-success" : "text-primary"}`}>
                            {item.proposedConfirmed ? "Confirmed" : "Unconfirmed"}
                          </div>
                        </>
                      ) : (
                        <span className="font-sans text-[11px] text-primary">Removed in request</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top font-mono text-[11px] text-muted-foreground">
                      {item.currentStart !== null && item.proposedStart !== null && (
                        <div>start {formatSignedTime(item.proposedStart - item.currentStart)}</div>
                      )}
                      {item.currentEnd !== null && item.proposedEnd !== null && (
                        <div className="mt-1">end {formatSignedTime(item.proposedEnd - item.currentEnd)}</div>
                      )}
                      {item.currentTitle !== item.proposedTitle && item.currentTitle !== null && item.proposedTitle !== null && (
                        <div className="mt-1 font-sans text-primary">title changed</div>
                      )}
                      {!item.currentTitle && item.proposedTitle && <div className="font-sans text-primary">song added</div>}
                      {item.currentTitle && !item.proposedTitle && <div className="font-sans text-primary">song removed</div>}
                      {item.currentConfirmed !== item.proposedConfirmed && (
                        <div className="mt-1 font-sans text-primary">
                          status changed
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="mb-4 flex gap-2 overflow-x-auto border-b border-border pb-2">
        {songs.map((item, index) => {
          const changed =
            item.title !== item.baseTitle ||
            item.clipStart !== formatTimeInput(item.baseStart) ||
            item.clipEnd !== formatTimeInput(item.baseEnd) ||
            item.confirmed !== item.baseConfirmed ||
            item.removed ||
            item.isNew;
          return (
            <button
              key={item.index}
              type="button"
              onClick={() => setCurrentIndex(index)}
              className={`shrink-0 rounded-lg px-3 py-2 text-left text-[12px] ${
                index === currentIndex ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60"
              }`}
            >
              <span className="font-mono">{item.index}</span> {item.title} {item.removed && <span className="text-[10px] uppercase text-primary">(removed)</span>}
              {changed && <span className="ml-1 text-primary">●</span>}
            </button>
          );
        })}
      </div>

      {song && !song.removed && (
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
            <div className="flex items-end justify-between gap-3">
              <label className="min-w-0 flex-1 text-[12px] font-medium text-muted-foreground">
                Song title
                <input
                  value={song.title}
                  onChange={(event) => updateTitle(song.index, event.target.value)}
                  maxLength={200}
                  aria-label={`${song.title} title`}
                  className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-2.5 text-[15px] font-semibold text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </label>
              <button
                type="button"
                onClick={() => setSongRemoved(song.index, true)}
                className="shrink-0 rounded-lg border border-primary/40 px-3 py-2 text-[12px] font-medium text-primary hover:bg-primary/5"
              >
                Remove song
              </button>
            </div>
            <div className="font-mono text-xs text-muted-foreground mb-4.5">
              current clip {formatTime(currentStart)} &ndash; {formatTime(currentEnd)}
            </div>

            {isAdmin && (
              <div className="mb-4 rounded-lg border border-border bg-background/50 p-3">
                <div className="text-[12px] font-semibold text-foreground">Boundary status</div>
                <p className="mt-1 text-[11.5px] text-muted-foreground">
                  Mark this boundary confirmed only when you trust both timestamps.
                </p>
                <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={`${song.title} boundary status`}>
                  <button
                    type="button"
                    aria-pressed={song.confirmed}
                    onClick={() => updateConfirmation(song.index, true)}
                    className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium ${song.confirmed ? "border-success/60 bg-success/10 text-success" : "border-input text-muted-foreground hover:text-foreground"}`}
                  >
                    Confirmed
                  </button>
                  <button
                    type="button"
                    aria-pressed={!song.confirmed}
                    onClick={() => updateConfirmation(song.index, false)}
                    className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium ${!song.confirmed ? "border-primary/60 bg-primary/10 text-primary" : "border-input text-muted-foreground hover:text-foreground"}`}
                  >
                    Unconfirmed
                  </button>
                </div>
              </div>
            )}

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

      {song?.removed && (
        <div className="rounded-[10px] border border-primary/30 bg-primary/5 p-5">
          <div className="text-[15px] font-semibold text-foreground">{song.title}</div>
          <p className="mt-1 text-[12px] text-muted-foreground">This song is removed from the revision and will not be included when it is submitted.</p>
          <button
            type="button"
            onClick={() => setSongRemoved(song.index, false)}
            className="mt-4 rounded-lg border border-border px-3.5 py-2 text-[12px] font-medium text-muted-foreground hover:text-foreground"
          >
            Restore song
          </button>
        </div>
      )}

      <div className="mt-4 flex justify-between">
        <button type="button" onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))} disabled={currentIndex === 0} className="rounded-lg border border-border px-3.5 py-2 text-[13px] text-muted-foreground disabled:opacity-40">← Previous song</button>
        <button type="button" onClick={() => setCurrentIndex(Math.min(songs.length - 1, currentIndex + 1))} disabled={songs.length === 0 || currentIndex >= songs.length - 1} className="rounded-lg border border-border px-3.5 py-2 text-[13px] text-muted-foreground disabled:opacity-40">Next song →</button>
      </div>

      <form className="mt-5 border-t border-border pt-5">
        <input type="hidden" name="performance_video_id" value={performance.videoId} />
        <input type="hidden" name="draft" value={draftJson} />
        {request && <input type="hidden" name="request_id" value={request.id} />}
        {isAdmin && request?.status === "pending" && (
          <input ref={resolveDecisionRef} type="hidden" name="decision" defaultValue="approve" />
        )}

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
                  <button formAction={resolveAction} type="submit" onClick={() => { if (resolveDecisionRef.current) resolveDecisionRef.current.value = "approve"; }} disabled={isPending} className="rounded-lg bg-primary px-3.5 py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-60">{resolvePending ? "Applying…" : "Apply as main truth"}</button>
                  <button formAction={resolveAction} type="submit" onClick={() => { if (resolveDecisionRef.current) resolveDecisionRef.current.value = "reject"; }} disabled={isPending} className="rounded-lg border border-primary/50 px-3.5 py-2 text-[13px] font-medium text-primary disabled:opacity-60">Reject request</button>
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
