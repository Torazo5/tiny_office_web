import { Heart } from "lucide-react";
import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { LikedSongsList } from "@/components/liked-songs-list";
import { getCurrentUser } from "@/lib/auth";
import { getUserLikedSongs } from "@/lib/engagement-data";

export default async function LikedSongsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/liked-songs");

  const songs = await getUserLikedSongs(user.id);

  return (
    <>
      <Header user={user} />
      <main className="mx-auto flex w-full max-w-[980px] flex-col gap-7 p-4 sm:gap-8 sm:p-8">
        <section className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
          <div>
            <div className="mb-2 flex items-center gap-2 text-primary">
              <Heart aria-hidden className="size-4 fill-current" />
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em]">Your collection</span>
            </div>
            <h1 className="text-[28px] font-bold tracking-tight text-foreground">Liked songs</h1>
            <p className="mt-1.5 text-[13.5px] text-muted-foreground">
              The songs you saved for another listen.
            </p>
          </div>
          <span className="font-mono text-sm text-muted-foreground">
            {songs.length} {songs.length === 1 ? "song" : "songs"}
          </span>
        </section>

        <LikedSongsList songs={songs} />
      </main>
    </>
  );
}
