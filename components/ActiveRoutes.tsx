"use client";

import { RouteCard } from "@/components/RouteCard";
import { MultiRouteDashboard } from "@/components/MultiRouteDashboard";
import type { ActiveRoute } from "@/lib/tfl/types";

interface ActiveRoutesProps {
  activeRoutes: ActiveRoute[];
  favouriteRoutes: string[];
  onActiveRoutesChange: (routes: ActiveRoute[]) => void;
  onToggleFavourite: (routeId: string) => void;
}

export function ActiveRoutes({
  activeRoutes,
  favouriteRoutes,
  onActiveRoutesChange,
  onToggleFavourite,
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
          Add a London bus route above to see the schematic loop or detailed
          stop list.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <MultiRouteDashboard activeRoutes={activeRoutes} />

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

      <div className="grid gap-6 xl:grid-cols-1">
        {activeRoutes.map((route) => (
          <RouteCard
            key={route.routeId}
            activeRoute={route}
            onRemove={handleRemove}
            isFavourite={favouriteRoutes.includes(route.routeId)}
            onToggleFavourite={onToggleFavourite}
          />
        ))}
      </div>
    </section>
  );
}
