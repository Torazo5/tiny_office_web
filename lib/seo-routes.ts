import type { Performance } from "@/lib/types";

export type SeoPerformance = Pick<Performance, "videoId" | "artist" | "sourceTitle" | "concertSlug"> & {
  songs?: Performance["songs"];
};

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

function getConcertSlugBase(performance: SeoPerformance, stripNprMusic: boolean): string {
  const concertName = getConcertName(performance)
    .replace(stripNprMusic ? /\bnpr\s+music\b/gi : /$^/, "")
    .replace(/\bconcert\b/gi, "")
    .trim();

  return slugify(`${performance.artist} ${concertName || "Tiny Desk"}`);
}

function getBaseConcertSlug(performance: SeoPerformance): string {
  return getConcertSlugBase(performance, true);
}

function compareStableConcertIdentity(left: SeoPerformance, right: SeoPerformance): number {
  return left.videoId < right.videoId ? -1 : left.videoId > right.videoId ? 1 : 0;
}

export function getConcertSlug(
  performance: SeoPerformance,
  allPerformances?: readonly SeoPerformance[],
): string {
  const baseSlug = getBaseConcertSlug(performance);
  if (!allPerformances) return performance.concertSlug ?? baseSlug;

  const conflicts = allPerformances.filter(
    (candidate) => getBaseConcertSlug(candidate) === baseSlug,
  );
  if (conflicts.length <= 1) return baseSlug;

  const occurrence = [...conflicts]
    .sort(compareStableConcertIdentity)
    .findIndex((candidate) => candidate.videoId === performance.videoId);
  return `${baseSlug}-${Math.max(0, occurrence) + 1}`;
}

export function getConcertPath(
  performance: SeoPerformance,
  allPerformances?: readonly SeoPerformance[],
): string {
  return `/concerts/${getConcertSlug(performance, allPerformances)}`;
}

export function getConcertSlugMap(
  performances: readonly SeoPerformance[],
): Record<string, string> {
  return Object.fromEntries(
    performances.map((performance) => [performance.videoId, getConcertSlug(performance, performances)]),
  );
}

/** Slugs emitted before duplicate concert identities received numeric suffixes. */
export function getLegacyConcertSlugs(performance: SeoPerformance): string[] {
  const displaySlug = getConcertSlugBase(performance, false);
  const disambiguatedSlug = `${getBaseConcertSlug(performance)}-${slugify(performance.videoId)}`;
  return [...new Set([displaySlug, disambiguatedSlug])];
}

export function getConcertRoutes(performances: Performance[]): ConcertRoute[] {
  return performances.map((performance) => ({
    performance,
    slug: getConcertSlug(performance, performances),
  }));
}

export function getConcertDescription(performance: SeoPerformance): string {
  const details = !performance.songs || performance.songs.length > 0
    ? "with the full setlist and playable song clips"
    : "with the available concert details";
  return `Listen to ${performance.artist}'s ${getConcertName(performance)} song by song in Tiny Office, ${details}.`;
}
