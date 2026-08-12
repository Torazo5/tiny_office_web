import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { getSeoArtist, getSeoArtists, getSeoPerformances } from "@/lib/seo-data";
import { getArtistPath, getConcertName, getConcertPath } from "@/lib/seo-routes";
import { getSiteUrl } from "@/lib/site-url";

type ArtistPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const artists = await getSeoArtists();
  return artists.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: ArtistPageProps): Promise<Metadata> {
  const { slug } = await params;
  const artist = await getSeoArtist(slug);
  if (!artist) return {};

  return {
    title: `${artist.artist} Tiny Desk concerts | Tiny Office`,
    description: `Explore ${artist.artist} Tiny Desk concerts and listen to each set song by song in Tiny Office.`,
    alternates: {
      canonical: new URL(getArtistPath(artist.artist), getSiteUrl()).toString(),
    },
  };
}

export default async function ArtistPage({ params }: ArtistPageProps) {
  const { slug } = await params;
  const artist = await getSeoArtist(slug);
  if (!artist) notFound();

  const allPerformances = await getSeoPerformances();

  return (
    <>
      <Header user={null} />
      <main className="mx-auto w-full max-w-4xl p-4 sm:p-8">
        <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Artist
        </p>
        <h1 className="text-3xl font-bold text-foreground">{artist.artist}</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-7 text-muted-foreground">
          Explore {artist.artist} Tiny Desk concerts and listen to each set song by song in Tiny Office.
        </p>

        <section className="mt-10" aria-labelledby="artist-concerts-heading">
          <h2 id="artist-concerts-heading" className="text-xl font-semibold text-foreground">
            Tiny Desk concerts
          </h2>
          <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
            {artist.performances.map((performance) => (
              <li key={performance.videoId}>
                <Link
                  href={getConcertPath(performance, allPerformances)}
                  className="flex items-center justify-between gap-4 px-4 py-4 transition-colors hover:bg-secondary/50 sm:px-5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold text-foreground">
                      {getConcertName(performance)}
                    </span>
                    <span className="mt-1 block text-[12.5px] text-muted-foreground">
                      {performance.songs.length} {performance.songs.length === 1 ? "song" : "songs"}
                      {performance.date ? ` · ${performance.date}` : ""}
                    </span>
                  </span>
                  <span aria-hidden className="shrink-0 text-primary">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

      </main>
    </>
  );
}
