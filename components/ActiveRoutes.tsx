"use client";

import { RouteCard } from "@/components/RouteCard";
import type { ActiveRoute } from "@/lib/tfl/types";

interface ActiveRoutesProps {
  activeRoutes: ActiveRoute[];
  onActiveRoutesChange: (routes: ActiveRoute[]) => void;
}

export function ActiveRoutes({
  activeRoutes,
  onActiveRoutesChange,
}: ActiveRoutesProps): React.ReactElement {
  const handleRemove = (routeId: string) => {
    onActiveRoutesChange(
      activeRoutes.filter((route) => route.routeId !== routeId),
    );
  };

  const handleClearAll = () => {
    onActiveRoutesChange([]);
  };

  if (activeRoutes.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          No active routes yet
        </h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Add a London bus route above to see its stop diagram and live
          predictions.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Active routes ({activeRoutes.length})
        </h2>
        <button
          type="button"
          onClick={handleClearAll}
          className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          Clear all
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {activeRoutes.map((route) => (
          <RouteCard
            key={route.routeId}
            activeRoute={route}
            onRemove={handleRemove}
          />
        ))}
      </div>
    </section>
  );
}
