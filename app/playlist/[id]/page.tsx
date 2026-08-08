import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { PlaceholderThumb } from "@/components/placeholder-thumb";
import { formatTime } from "@/lib/format";
import { getPlaylist } from "@/lib/data";

/**
 * Playlists span multiple performances — a pure product concept, no
 * pipeline data behind it. Track rows are static; the design's
 * "currently playing" state (equalizer icon, highlighted row) needs a
 * real audio/video player instance to be meaningful, which doesn't exist
 * in this scaffold, so no row is marked as playing here.
 */
export default async function PlaylistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const playlist = await getPlaylist(id);
  if (!playlist) notFound();

  const totalSeconds = playlist.tracks.reduce((sum, t) => sum + t.duration, 0);

  return (
    <>
      <Header />
      <main className="p-8">
        <div className="flex gap-6 items-end mb-7">
          <PlaceholderThumb label="COVER" className="w-[180px] h-[180px] shrink-0 rounded-[10px]" />
          <div>
            <div className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Playlist
            </div>
            <h1 className="text-[32px] font-bold text-foreground mb-2.5">{playlist.name}</h1>
            <p className="text-[13px] text-muted-foreground mb-4.5">
              by {playlist.owner} · {playlist.tracks.length} songs · {Math.round(totalSeconds / 60)} min
            </p>
            <div className="flex items-center gap-3.5">
              <div className="w-[46px] h-[46px] rounded-full bg-primary flex items-center justify-center cursor-not-allowed">
                <div
                  className="ml-0.5"
                  style={{
                    width: 0,
                    height: 0,
                    borderStyle: "solid",
                    borderWidth: "9px 0 9px 15px",
                    borderColor: "transparent transparent transparent var(--primary-foreground)",
                  }}
                />
              </div>
              <span className="text-[13px] font-medium text-muted-foreground cursor-not-allowed">
                + Add songs
              </span>
            </div>
          </div>
        </div>

        <div
          className="grid px-3.5 py-2 border-b border-border font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80"
          style={{ gridTemplateColumns: "28px 1fr 1.1fr 70px" }}
        >
          <div>#</div>
          <div>Title</div>
          <div>From performance</div>
          <div className="text-right">Time</div>
        </div>
        {playlist.tracks.map((t) => (
          <div
            key={t.index}
            className="grid items-center px-3.5 py-2.5 rounded-lg hover:bg-secondary/50 transition-colors"
            style={{ gridTemplateColumns: "28px 1fr 1.1fr 70px" }}
          >
            <div className="font-mono text-xs text-muted-foreground">{t.index}</div>
            <div>
              <div className="text-[13.5px] font-medium text-foreground">{t.title}</div>
              <div className="text-xs text-muted-foreground">{t.artist}</div>
            </div>
            <div className="text-[12.5px] text-muted-foreground">{t.performanceLabel}</div>
            <div className="font-mono text-xs text-muted-foreground text-right">
              {formatTime(t.duration)}
            </div>
          </div>
        ))}
      </main>
    </>
  );
}
