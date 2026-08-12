import type { MetadataRoute } from "next";
import { getSeoArtists, getSeoConcerts } from "@/lib/seo-data";
import { getArtistPath, getConcertPath } from "@/lib/seo-routes";
import { getSiteUrl } from "@/lib/site-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [artists, concerts] = await Promise.all([getSeoArtists(), getSeoConcerts()]);
  const siteUrl = getSiteUrl();
  const absoluteUrl = (path: string) => new URL(path, siteUrl).toString();

  return [
    {
      url: absoluteUrl("/"),
      changeFrequency: "daily",
      priority: 1,
    },
    ...artists.map((artist) => ({
      url: absoluteUrl(getArtistPath(artist.artist)),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...concerts.map(({ performance }) => ({
      url: absoluteUrl(getConcertPath(performance, concerts.map((concert) => concert.performance))),
      lastModified: performance.date ?? undefined,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
  ];
}
