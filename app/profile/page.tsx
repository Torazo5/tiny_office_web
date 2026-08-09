import { redirect } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { ProfileFavorites } from "@/components/profile-favorites";
import { StarRating } from "@/components/star-rating";
import { YouTubeThumbnail } from "@/components/youtube-thumbnail";
import { getCurrentUser } from "@/lib/auth";
import { getPerformances } from "@/lib/data";
import { getUserReviews } from "@/lib/engagement-data";
import { getProfileStats } from "@/lib/profile-data";

function displayName(user: { user_metadata?: Record<string, unknown>; email?: string | null }) {
  const metadata = user.user_metadata ?? {};
  return (
    String(metadata.full_name ?? metadata.name ?? "").trim() ||
    user.email?.split("@")[0] ||
    "Anonymous"
  );
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(new Date(date));
}

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/profile");

  const [performances, reviews] = await Promise.all([
    getPerformances(),
    getUserReviews(user.id),
  ]);
  const stats = await getProfileStats(user.id, performances);
  const name = displayName(user);

  return (
    <>
      <Header />
      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-9 p-8">
        <section className="flex flex-wrap items-end justify-between gap-5 border-b border-border pb-7">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 font-mono text-xl font-semibold text-primary">
              {name.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <h1 className="text-[28px] font-bold tracking-tight text-foreground">{name}</h1>
              <p className="mt-1 text-[12.5px] text-muted-foreground">Joined {formatDate(user.created_at)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-5 text-right">
            <div>
              <div className="font-mono text-xl font-semibold text-foreground">{stats.listenedDeskCount}</div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Tiny Desks listened</div>
            </div>
            <div>
              <div className="font-mono text-xl font-semibold text-foreground">{Math.round(stats.totalSecondsListened / 60)}</div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Minutes listened</div>
            </div>
            <div>
              <div className="font-mono text-xl font-semibold text-foreground">{reviews.length}</div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Reviews</div>
            </div>
          </div>
        </section>

        <ProfileFavorites
          favorites={stats.favorites}
          performances={performances.map(({ videoId, artist, date }) => ({ videoId, artist, date }))}
        />

        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Your reviews</h2>
              <p className="mt-1 text-[12.5px] text-muted-foreground">A catalogue of everything you have written.</p>
            </div>
            <span className="font-mono text-xs text-muted-foreground">{reviews.length}</span>
          </div>
          {reviews.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
              <p className="text-sm font-semibold text-foreground">No reviews yet</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Rate a performance, then write a few words about it.
              </p>
              <Link href="/" className="mt-4 inline-block text-[12.5px] font-medium text-primary hover:underline">
                Browse performances →
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {reviews.map((review) => (
                <article key={review.id} className="rounded-xl border border-border bg-card/50 p-4">
                  <div className="flex gap-3">
                    <Link href={`/video/${review.performanceVideoId}`} className="block h-16 w-28 shrink-0 overflow-hidden rounded-lg">
                      <YouTubeThumbnail
                        videoId={review.performanceVideoId}
                        alt={`${review.artist} Tiny Desk Concert`}
                        className="h-full w-full"
                        sizes="112px"
                      />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link href={`/video/${review.performanceVideoId}`} className="truncate text-[14px] font-semibold text-foreground hover:text-primary">
                        {review.artist}
                      </Link>
                      <div className="mt-1 flex items-center gap-2">
                        <StarRating rating={review.rating} size="text-[12px]" />
                        <span className="font-mono text-[11px] text-muted-foreground">{review.rating.toFixed(1)}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">{formatDate(review.createdAt)}</div>
                    </div>
                  </div>
                  <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{review.text}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
