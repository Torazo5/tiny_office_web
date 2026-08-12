import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Header } from "@/components/header";
import { getSeoConcert, getSeoConcerts } from "@/lib/seo-data";
import {
  getArtistPath,
  getConcertDescription,
  getConcertName,
} from "@/lib/seo-routes";
import { getSiteUrl } from "@/lib/site-url";
import { formatClipDuration, formatTime } from "@/lib/format";

type ConcertPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const concerts = await getSeoConcerts();
  return concerts.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: ConcertPageProps): Promise<Metadata> {
  const { slug } = await params;
  const concert = await getSeoConcert(slug);
  if (!concert) return {};

  const { performance } = concert;
  return {
    title: `${performance.artist}: ${getConcertName(performance)} | Tiny Office`,
    description: getConcertDescription(performance),
    alternates: {
      canonical: new URL(`/concerts/${concert.slug}`, getSiteUrl()).toString(),
    },
  };
}

export default async function ConcertPage({ params }: ConcertPageProps) {
  const { slug } = await params;
  const concert = await getSeoConcert(slug);
  if (!concert) notFound();
  if (slug !== concert.slug) permanentRedirect(`/concerts/${concert.slug}`);

  const { performance } = concert;
  const artistPath = getArtistPath(performance.artist);
  const playerPath = `/video/${performance.videoId}`;

  return (
    <>
      <Header user={null} />
      <main className="mx-auto w-full max-w-4xl p-4 sm:p-8">
        <Link href={artistPath} className="text-[13px] font-medium text-primary hover:underline">
          ← {performance.artist}
        </Link>
        <p className="mt-8 mb-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Tiny Desk concert
        </p>
        <h1 className="text-3xl font-bold text-foreground">
          {performance.artist}: {getConcertName(performance)}
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-7 text-muted-foreground">
          {getConcertDescription(performance)}
        </p>
        {performance.date && (
          <p className="mt-2 text-[12.5px] text-muted-foreground">Published {performance.date}</p>
        )}

        <section className="mt-10" aria-labelledby="setlist-heading">
          <div className="flex items-end justify-between gap-4">
            <h2 id="setlist-heading" className="text-xl font-semibold text-foreground">
              Setlist
            </h2>
            <span className="font-mono text-[11px] text-muted-foreground">
              {performance.songs.length} {performance.songs.length === 1 ? "song" : "songs"}
            </span>
          </div>
          {performance.songs.length > 0 ? (
            <ol className="mt-4 divide-y divide-border rounded-xl border border-border">
              {performance.songs.map((song) => (
                <li key={song.index}>
                  <Link
                    href={`${playerPath}?song=${song.index}`}
                    className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-secondary/50 sm:px-5"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="w-5 shrink-0 font-mono text-[11px] text-muted-foreground">{song.index}</span>
                      <span className="truncate text-[15px] font-medium text-foreground">{song.title}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                      {formatTime(song.clipStart)} · {formatClipDuration(song.clipStart, song.clipEnd)}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 rounded-xl border border-dashed border-border px-5 py-8 text-[14px] text-muted-foreground">
              The setlist for this concert is not available yet.
            </p>
          )}
        </section>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href={playerPath}
            className="inline-flex min-h-10 items-center rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Open player
          </Link>
          <Link href={getArtistPath(performance.artist)} className="text-[13px] font-medium text-muted-foreground hover:text-foreground">
            More from {performance.artist}
          </Link>
        </div>
      </main>
    </>
  );
}
