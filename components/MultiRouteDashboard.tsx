"use client";

import { useRouteIntelligence } from "@/hooks/useRouteIntelligence";
import { formatLastUpdated } from "@/lib/format";
import type { ActiveRoute, RouteDashboardSummary } from "@/lib/tfl/types";

function healthToneClass(score: number): string {
  if (score >= 85) {
    return "text-emerald-300";
  }
  if (score >= 65) {
    return "text-sky-300";
  }
  if (score >= 40) {
    return "text-amber-300";
  }
  return "text-red-300";
}

function formatDashboardStatus(summary: RouteDashboardSummary): string {
  const parts = [`${summary.liveVehicleCount} live`];

  if (summary.largestGapMinutes !== null) {
    parts.push(`largest gap ${summary.largestGapMinutes} min`);
  }

  if (summary.largeGapCount > 0) {
    parts.push(
      `${summary.largeGapCount} large gap${summary.largeGapCount === 1 ? "" : "s"}`,
    );
  }

  if (summary.bunchingClusterCount > 0) {
    parts.push(
      `${summary.bunchingClusterCount} bunching`,
    );
  }

  if (summary.isDataStale) {
    parts.push("stale data");
  }

  if (summary.missingFromRefreshCount > 0) {
    parts.push(
      `${summary.missingFromRefreshCount} missing`,
    );
  }

  if (summary.disappearedPredictionCount > 0) {
    parts.push(
      `${summary.disappearedPredictionCount} disappeared`,
    );
  }

  return parts.join(" · ");
}

interface DashboardRouteItemProps {
  route: ActiveRoute;
  onSelect: (routeId: string) => void;
}

function DashboardRouteItem({
  route,
  onSelect,
}: DashboardRouteItemProps): React.ReactElement {
  const { arrivalsQuery, intelligence } = useRouteIntelligence(route.routeId);
  const summary = intelligence?.dashboardSummary;

  if (!summary) {
    return (
      <button
        type="button"
        onClick={() => onSelect(route.routeId)}
        className="flex min-w-[220px] flex-col gap-1 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-left hover:border-sky-500/50"
      >
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
            {route.routeId}
          </span>
          <span className="text-xs text-zinc-500">Loading…</span>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(route.routeId)}
      className="flex min-w-[220px] flex-col gap-1 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-left hover:border-sky-500/50"
    >
      <div className="flex items-center gap-2">
        <span className="rounded-lg bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
          {route.routeId}
        </span>
        <span className={`text-xs font-semibold ${healthToneClass(summary.healthScore)}`}>
          {summary.healthLabel}
        </span>
        <span className="ml-auto text-xs text-zinc-400">
          {summary.healthScore}/100
        </span>
      </div>
      <p className="text-xs text-zinc-400">{formatDashboardStatus(summary)}</p>
      <p className="text-[11px] text-zinc-500">
        Updated{" "}
        {arrivalsQuery.dataUpdatedAt
          ? formatLastUpdated(new Date(arrivalsQuery.dataUpdatedAt))
          : "—"}
        {arrivalsQuery.isFetching ? " · refreshing…" : ""}
      </p>
    </button>
  );
}

interface MultiRouteDashboardProps {
  activeRoutes: ActiveRoute[];
}

export function MultiRouteDashboard({
  activeRoutes,
}: MultiRouteDashboardProps): React.ReactElement | null {
  if (activeRoutes.length < 2) {
    return null;
  }

  const handleSelect = (routeId: string) => {
    const element = document.getElementById(`route-card-${routeId}`);
    element?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Live route dashboard
        </p>
        <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Auto-refreshing
        </span>
      </div>
      <div className="flex gap-2">
        {activeRoutes.map((route) => (
          <DashboardRouteItem
            key={route.routeId}
            route={route}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </div>
  );
}
