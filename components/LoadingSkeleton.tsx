export function RouteCardSkeleton(): React.ReactElement {
  return (
    <div className="animate-pulse rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="h-6 w-32 rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="mt-3 h-4 w-64 rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800"
          />
        ))}
      </div>
    </div>
  );
}
