import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const eventNames = new Set([
  "landing_viewed", "performance_opened", "search_submitted", "catalog_load_more",
  "song_play_started", "adventure_started", "playlist_created", "item_added_to_playlist",
  "rating_saved", "review_published", "sign_in_started", "sign_in_completed", "error_shown",
]);

export type ProductEventInput = {
  eventName: string;
  route?: string;
  source?: string;
  performanceVideoId?: string;
  songIndex?: number;
  adventureMode?: string;
  resultCount?: number;
  loadMorePage?: number;
  queryLength?: number;
  errorCategory?: string;
  visitorId?: string;
  sessionId?: string;
};

function optionalText(value: unknown, maxLength: number) {
  return typeof value === "string" && value.length <= maxLength ? value : null;
}

function optionalInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

export function sanitizeProductEvent(input: unknown): ProductEventInput | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  if (typeof value.eventName !== "string" || !eventNames.has(value.eventName)) return null;
  const visitorId = optionalText(value.visitorId, 36);
  const sessionId = optionalText(value.sessionId, 36);
  if (!visitorId || !sessionId) return null;
  return {
    eventName: value.eventName,
    route: optionalText(value.route, 200) ?? undefined,
    source: optionalText(value.source, 80) ?? undefined,
    performanceVideoId: optionalText(value.performanceVideoId, 32) ?? undefined,
    songIndex: optionalInteger(value.songIndex) ?? undefined,
    adventureMode: optionalText(value.adventureMode, 32) ?? undefined,
    resultCount: optionalInteger(value.resultCount) ?? undefined,
    loadMorePage: optionalInteger(value.loadMorePage) ?? undefined,
    queryLength: optionalInteger(value.queryLength) ?? undefined,
    errorCategory: optionalText(value.errorCategory, 80) ?? undefined,
    visitorId,
    sessionId,
  };
}

export async function recordProductEvent(event: ProductEventInput) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("product_events").insert({
    event_name: event.eventName,
    route: event.route ?? null,
    source: event.source ?? null,
    performance_video_id: event.performanceVideoId ?? null,
    song_index: event.songIndex ?? null,
    adventure_mode: event.adventureMode ?? null,
    result_count: event.resultCount ?? null,
    load_more_page: event.loadMorePage ?? null,
    query_length: event.queryLength ?? null,
    error_category: event.errorCategory ?? null,
    visitor_id: event.visitorId ?? null,
    session_id: event.sessionId ?? null,
  });
  if (error) throw new Error("Could not record product event.");
}
