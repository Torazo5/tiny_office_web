import "server-only";

import { cache } from "react";
import { getPerformances } from "@/lib/data";
import {
  getCanonicalArtistSlug,
  getArtistSlug,
  getConcertRoutes,
} from "@/lib/seo-routes";
import type { Performance } from "@/lib/types";

export const getSeoPerformances = cache(async (): Promise<Performance[]> => getPerformances());

export type SeoArtist = {
  artist: string;
  performances: Performance[];
  slug: string;
};

export const getSeoArtists = cache(async (): Promise<SeoArtist[]> => {
  const performances = await getSeoPerformances();
  const artists = new Map<string, SeoArtist>();

  for (const performance of performances) {
    const slug = getArtistSlug(performance.artist);
    const existing = artists.get(slug);
    if (existing) {
      existing.performances.push(performance);
    } else {
      artists.set(slug, { artist: performance.artist, performances: [performance], slug });
    }
  }

  return [...artists.values()].sort((left, right) => left.artist.localeCompare(right.artist));
});

export const getSeoArtist = cache(async (slug: string): Promise<SeoArtist | null> => {
  const artists = await getSeoArtists();
  const canonicalSlug = getCanonicalArtistSlug(slug);
  return artists.find((artist) => artist.slug === canonicalSlug) ?? null;
});

export const getSeoConcerts = cache(async () => getConcertRoutes(await getSeoPerformances()));

export const getSeoConcert = cache(async (slug: string) => {
  const concerts = await getSeoConcerts();
  return concerts.find((concert) => concert.slug === slug) ?? null;
});
