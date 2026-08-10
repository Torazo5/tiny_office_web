"use client";

import { useEffect } from "react";

export type ProductEventName =
  | "landing_viewed"
  | "performance_opened"
  | "search_submitted"
  | "catalog_load_more"
  | "song_play_started"
  | "adventure_started"
  | "playlist_created"
  | "item_added_to_playlist"
  | "rating_saved"
  | "review_published"
  | "sign_in_started"
  | "sign_in_completed"
  | "error_shown";

type ProductEvent = {
  eventName: ProductEventName;
  source?: string;
  performanceVideoId?: string;
  songIndex?: number;
  adventureMode?: string;
  resultCount?: number;
  loadMorePage?: number;
  queryLength?: number;
  errorCategory?: string;
};

function getIdentifier(storage: Storage, key: string) {
  const existing = storage.getItem(key);
  if (existing) return existing;
  const identifier = crypto.randomUUID();
  storage.setItem(key, identifier);
  return identifier;
}

export function trackEvent(event: ProductEvent) {
  if (typeof window === "undefined") return;
  const payload = {
    ...event,
    route: window.location.pathname,
    visitorId: getIdentifier(window.localStorage, "tiny-office:visitor-id"),
    sessionId: getIdentifier(window.sessionStorage, "tiny-office:session-id"),
  };
  const body = JSON.stringify(payload);
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/analytics", new Blob([body], { type: "application/json" }));
    return;
  }
  void fetch("/api/analytics", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  });
}

export function AnalyticsOnMount({ event }: { event: ProductEvent }) {
  useEffect(() => {
    trackEvent(event);
  }, [event]);
  return null;
}
