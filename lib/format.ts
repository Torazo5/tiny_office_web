/** "0:00" / "12:34" style timestamp, matching the design handoff's mono timestamps. */
export function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/** clip_end - clip_start, formatted as a duration. */
export function formatClipDuration(clipStart: number, clipEnd: number): string {
  return formatTime(Math.max(0, clipEnd - clipStart));
}
