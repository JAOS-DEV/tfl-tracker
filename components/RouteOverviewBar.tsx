"use client";

import { useLineArrivals } from "@/hooks/useLineArrivals";
import { calculateRouteSummary } from "@/lib/headway";
import type { ActiveRoute } from "@/lib/tfl/types";

interface RouteOverviewItemProps {
  route: ActiveRoute;
  onSelect: (routeId: string) => void;
}

function RouteOverviewItem({
  route,
  onSelect,
}: RouteOverviewItemProps): React.ReactElement {
  const { data } = useLineArrivals(route.routeId);
  const summary = calculateRouteSummary(data?.predictions ?? []);

  return (
    <button
      type="button"
      onClick={() => onSelect(route.routeId)}
      className="flex min-w-[140px] items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-left text-sm text-zinc-100 hover:border-sky-500/50"
    >
      <span className="rounded-lg bg-red-600 px-2 py-0.5 text-xs font-bold">
        {route.routeId}
      </span>
      <span className="min-w-0 truncate text-zinc-400">{route.routeName}</span>
      <span className="ml-auto text-xs text-emerald-300">
        {summary.liveVehicleCount} live
      </span>
    </button>
  );
}

interface RouteOverviewBarProps {
  activeRoutes: ActiveRoute[];
}

export function RouteOverviewBar({
  activeRoutes,
}: RouteOverviewBarProps): React.ReactElement | null {
  if (activeRoutes.length < 2) {
    return null;
  }

  const handleSelect = (routeId: string) => {
    const element = document.getElementById(`route-card-${routeId}`);
    element?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
      <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
        Quick jump
      </p>
      <div className="flex gap-2">
        {activeRoutes.map((route) => (
          <RouteOverviewItem
            key={route.routeId}
            route={route}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </div>
  );
}
