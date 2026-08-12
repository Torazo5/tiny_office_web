import type { Performance } from "@/lib/types";

export type SeoPerformance = Pick<Performance, "videoId" | "artist" | "sourceTitle">;

export type ConcertRoute = {
  performance: Performance;
  slug: string;
};

export function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "unknown";
}

export function getArtistSlug(artist: string): string {
  return slugify(artist);
}

const artistSlugAliases: Record<string, string> = {
  "daniel-ceasar": "daniel-caesar",
};

export function getCanonicalArtistSlug(slug: string): string {
  return artistSlugAliases[slug] ?? slug;
}

export function getArtistPath(artist: string): string {
  return `/artists/${getArtistSlug(artist)}`;
}

export function getConcertName(performance: SeoPerformance): string {
  const sourceTitle = performance.sourceTitle.trim();
  const artistPrefix = `${performance.artist}:`;

  if (sourceTitle.toLowerCase().startsWith(artistPrefix.toLowerCase())) {
    return sourceTitle.slice(artistPrefix.length).trim() || "Tiny Desk Concert";
  }

  return sourceTitle || "Tiny Desk Concert";
}

function getBaseConcertSlug(performance: SeoPerformance): string {
  const concertName = getConcertName(performance)
    .replace(/\bconcert\b/gi, "")
    .trim();

  return slugify(`${performance.artist} ${concertName || "Tiny Desk"}`);
}

export function getConcertSlug(
  performance: SeoPerformance,
  allPerformances?: readonly SeoPerformance[],
): string {
  const baseSlug = getBaseConcertSlug(performance);
  if (!allPerformances) return baseSlug;

  const conflicts = allPerformances.filter(
    (candidate) => getBaseConcertSlug(candidate) === baseSlug,
  );
  return conflicts.length > 1 ? `${baseSlug}-${slugify(performance.videoId)}` : baseSlug;
}

export function getConcertPath(
  performance: SeoPerformance,
  allPerformances?: readonly SeoPerformance[],
): string {
  return `/concerts/${getConcertSlug(performance, allPerformances)}`;
}

export function getConcertRoutes(performances: Performance[]): ConcertRoute[] {
  return performances.map((performance) => ({
    performance,
    slug: getConcertSlug(performance, performances),
  }));
}

export function getConcertDescription(performance: SeoPerformance): string {
  return `Listen to ${performance.artist}'s ${getConcertName(performance)} song by song in Tiny Office, with the full setlist and playable song clips.`;
}
