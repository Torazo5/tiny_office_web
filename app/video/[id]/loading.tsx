export default function VideoLoading() {
  return (
    <main className="grid min-w-0 items-start gap-8 p-4 sm:p-8 lg:grid-cols-2 lg:gap-5" aria-label="Loading performance">
      <section className="min-w-0 animate-pulse space-y-4">
        <div className="aspect-video max-w-[680px] rounded-[10px] border border-border bg-secondary" />
        <div className="h-7 w-56 rounded bg-secondary" />
        <div className="h-4 w-44 rounded bg-secondary/80" />
        <div className="h-24 rounded-xl border border-border bg-secondary/60" />
      </section>
      <aside className="animate-pulse space-y-2">
        <div className="h-4 w-32 rounded bg-secondary" />
        {Array.from({ length: 7 }, (_, index) => (
          <div key={index} className="h-16 rounded-lg bg-secondary/70" />
        ))}
      </aside>
    </main>
  );
}
