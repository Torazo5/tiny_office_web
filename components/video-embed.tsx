"use client";

import { useEffect, useRef, useState } from "react";
import { usePlayer } from "@/components/player-context";

type YouTubePlayer = {
  destroy: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
};

type YouTubePlayerEvent = { target: YouTubePlayer };

type YouTubeApi = {
  Player: new (
    element: HTMLIFrameElement,
    options: { events: { onReady: (event: YouTubePlayerEvent) => void } },
  ) => YouTubePlayer;
};

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let iframeApiPromise: Promise<void> | null = null;

function loadYouTubeIframeApi() {
  if (window.YT?.Player) return Promise.resolve();
  if (iframeApiPromise) return iframeApiPromise;

  iframeApiPromise = new Promise((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      resolve();
    };

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => {
      iframeApiPromise = null;
      reject(new Error("Unable to load the YouTube IFrame Player API."));
    };
    document.head.append(script);
  });

  return iframeApiPromise;
}

/**
 * A stable YouTube iframe that the IFrame Player API seeks in place. Calling
 * `seekTo` preserves YouTube's existing paused or playing state, so clicking
 * a song never replaces the player or asks the viewer to start again.
 */
export function VideoEmbed({ videoId }: { videoId: string }) {
  const { startAt } = usePlayer();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const initialStartRef = useRef(Math.floor(startAt));
  const [isPlayerReady, setIsPlayerReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void loadYouTubeIframeApi()
      .then(() => {
        if (cancelled || !iframeRef.current || !window.YT?.Player) return;

        const player = new window.YT.Player(iframeRef.current, {
          events: {
            onReady: (event) => {
              if (cancelled) return;
              playerRef.current = event.target;
              setIsPlayerReady(true);
            },
          },
        });

        playerRef.current = player;
      })
      .catch(() => {
        // Native YouTube controls remain available if the API is unavailable.
      });

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isPlayerReady || startAt === initialStartRef.current) return;
    playerRef.current?.seekTo(Math.floor(startAt), true);
  }, [isPlayerReady, startAt]);

  return (
    <div className="relative aspect-video rounded-[10px] overflow-hidden mb-4 border border-border bg-black">
      <iframe
        ref={iframeRef}
        className="absolute inset-0 w-full h-full"
        src={`https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&start=${initialStartRef.current}&rel=0`}
        title="Tiny Desk Concert"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
