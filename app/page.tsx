import { Header } from "@/components/header";
import { PerformanceCard } from "@/components/performance-card";
import { getPerformances } from "@/lib/data";

export default async function BrowsePage() {
  const performances = await getPerformances();

  return (
    <>
      <Header showBack={false} />
      <main className="p-8">
        <h1 className="text-[22px] font-semibold text-foreground mb-1">
          Browse performances
        </h1>
        <p className="text-[13.5px] text-muted-foreground mb-6">
          {performances.length} concerts, individually playable by song
        </p>

        <div
          className="grid gap-[22px]"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}
        >
          {performances.map((p) => (
            <PerformanceCard key={p.videoId} performance={p} />
          ))}
        </div>
      </main>
    </>
  );
}
