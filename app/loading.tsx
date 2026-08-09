export default function Loading() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-[720px] animate-pulse space-y-4" aria-label="Loading Tiny Office">
        <div className="h-5 w-44 rounded bg-secondary" />
        <div className="h-3 w-72 rounded bg-secondary/80" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="space-y-2">
              <div className="aspect-video rounded-xl bg-secondary" />
              <div className="h-3 w-3/4 rounded bg-secondary" />
              <div className="h-3 w-1/2 rounded bg-secondary/80" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
