import "server-only";

export type YouTubeVideoSearchResult = {
  videoId: string;
  title: string;
  channelTitle: string;
  publishedAt: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  youtubeUrl: string;
};

type YouTubeSearchResponse = {
  items?: Array<{
    id?: { videoId?: string };
    snippet?: {
      title?: string;
      channelTitle?: string;
      publishedAt?: string;
      thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
    };
  }>;
};

type YouTubeVideoListResponse = {
  items?: Array<{
    id?: string;
    contentDetails?: { duration?: string };
    status?: { embeddable?: boolean };
  }>;
};

const YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3";
const MAX_RESULTS = 6;

function parseIsoDuration(value: string | undefined) {
  if (!value) return null;
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  const total = hours * 3600 + minutes * 60 + seconds;
  return Number.isFinite(total) ? total : null;
}

function getApiKey() {
  const key = process.env.YOUTUBE_DATA_API_KEY?.trim();
  return key || null;
}

export function isYouTubeSearchConfigured() {
  return Boolean(getApiKey());
}

async function readJson<T>(url: URL): Promise<T | null> {
  try {
    const response = await fetch(url, { next: { revalidate: 300 } });
    if (!response.ok) {
      console.error("[youtube-search] YouTube API request failed", {
        endpoint: url.pathname,
        status: response.status,
      });
      return null;
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error("[youtube-search] YouTube API request threw", {
      endpoint: url.pathname,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}

/**
 * Search public YouTube metadata for a missing Tiny Desk performance.
 * Returning an empty list when the key is not configured keeps the catalog
 * search and the manual request form useful in local development.
 */
export async function searchYouTubeVideos(query: string): Promise<YouTubeVideoSearchResult[]> {
  const apiKey = getApiKey();
  const trimmedQuery = query.trim().slice(0, 200);
  if (!apiKey || !trimmedQuery) return [];

  const searchUrl = new URL(`${YOUTUBE_API_URL}/search`);
  searchUrl.searchParams.set("key", apiKey);
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("q", trimmedQuery);
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("maxResults", String(MAX_RESULTS));
  searchUrl.searchParams.set("videoEmbeddable", "true");
  searchUrl.searchParams.set("safeSearch", "moderate");

  const searchData = await readJson<YouTubeSearchResponse>(searchUrl);
  const searchItems = (searchData?.items ?? []).filter((item) => item.id?.videoId);
  const videoIds = searchItems.map((item) => item.id!.videoId!);
  if (videoIds.length === 0) return [];

  const detailsUrl = new URL(`${YOUTUBE_API_URL}/videos`);
  detailsUrl.searchParams.set("key", apiKey);
  detailsUrl.searchParams.set("part", "contentDetails,status");
  detailsUrl.searchParams.set("id", videoIds.join(","));
  const detailsData = await readJson<YouTubeVideoListResponse>(detailsUrl);
  const detailsById = new Map(
    (detailsData?.items ?? [])
      .filter((item) => item.id && item.status?.embeddable !== false)
      .map((item) => [item.id!, item]),
  );

  return searchItems.flatMap((item) => {
    const videoId = item.id?.videoId;
    const snippet = item.snippet;
    if (!videoId || !snippet?.title || !detailsById.has(videoId)) return [];
    const details = detailsById.get(videoId);
    return [{
      videoId,
      title: snippet.title,
      channelTitle: snippet.channelTitle ?? "Unknown channel",
      publishedAt: snippet.publishedAt ?? null,
      thumbnailUrl: snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url ?? null,
      durationSeconds: parseIsoDuration(details?.contentDetails?.duration),
      youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
    } satisfies YouTubeVideoSearchResult];
  });
}
