"use client";

export type YouTubePlayer = {
  destroy: () => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
  loadVideoById: (videoId: string, startSeconds?: number) => void;
  pauseVideo: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
};

export type YouTubePlayerEvent = { target: unknown };
export type YouTubeStateChangeEvent = { data: number; target: unknown };

export type YouTubePlayerEvents = {
  onReady: (event: YouTubePlayerEvent) => void;
  onStateChange: (event: YouTubeStateChangeEvent) => void;
};

export type YouTubeApi = {
  Player: new (
    element: HTMLElement | string,
    options: {
      videoId?: string;
      playerVars?: Record<string, number | string>;
      events: YouTubePlayerEvents;
    },
  ) => unknown;
};

type YouTubeWindow = Window & {
  YT?: YouTubeApi;
  onYouTubeIframeAPIReady?: () => void;
  __tinyOfficeYouTubeApiPromise?: Promise<YouTubeApi>;
};

const YOUTUBE_IFRAME_API_URL = "https://www.youtube.com/iframe_api";

function youtubeWindow() {
  return window as YouTubeWindow;
}

export function isYouTubeApi(value: unknown): value is YouTubeApi {
  return Boolean(
    value &&
      typeof value === "object" &&
      "Player" in value &&
      typeof value.Player === "function",
  );
}

export function isYouTubePlayer(value: unknown): value is YouTubePlayer {
  if (!value || typeof value !== "object") return false;
  const player = value as Record<string, unknown>;
  return [
    "destroy",
    "getCurrentTime",
    "getPlayerState",
    "loadVideoById",
    "pauseVideo",
    "playVideo",
    "seekTo",
  ].every((method) => typeof player[method] === "function");
}

export function loadYouTubeIframeApi() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("The YouTube IFrame API requires a browser."));
  }

  const currentWindow = youtubeWindow();
  if (isYouTubeApi(currentWindow.YT)) return Promise.resolve(currentWindow.YT);
  if (currentWindow.__tinyOfficeYouTubeApiPromise) {
    return currentWindow.__tinyOfficeYouTubeApiPromise;
  }

  const promise = new Promise<YouTubeApi>((resolve, reject) => {
    const previousReady = currentWindow.onYouTubeIframeAPIReady;
    let settled = false;

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      currentWindow.__tinyOfficeYouTubeApiPromise = undefined;
      reject(error);
    };

    currentWindow.onYouTubeIframeAPIReady = () => {
      try {
        previousReady?.();
      } catch {
        // A separate integration must not prevent this app from resolving.
      }

      const api = currentWindow.YT;
      if (isYouTubeApi(api)) {
        if (!settled) {
          settled = true;
          resolve(api);
        }
      } else {
        fail(new Error("The YouTube IFrame API loaded without YT.Player."));
      }
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${YOUTUBE_IFRAME_API_URL}"]`,
    );
    if (existingScript) return;

    const script = document.createElement("script");
    script.src = YOUTUBE_IFRAME_API_URL;
    script.onerror = () => fail(new Error("Unable to load the YouTube IFrame Player API."));
    document.head.append(script);
  });

  currentWindow.__tinyOfficeYouTubeApiPromise = promise;
  return promise;
}

export function createYouTubePlayer(
  api: YouTubeApi,
  host: HTMLElement,
  videoId: string,
  events: YouTubePlayerEvents,
  startSeconds = 0,
) {
  const created = new api.Player(host, {
    videoId,
    playerVars: {
      playsinline: 1,
      rel: 0,
      modestbranding: 1,
      origin: window.location.origin,
      start: Math.max(0, Math.floor(startSeconds)),
    },
    events,
  });

  return isYouTubePlayer(created) ? created : null;
}
