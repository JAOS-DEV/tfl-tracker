"use client";

import { MultiRouteHistoryComparison } from "@/components/MultiRouteHistoryComparison";
import { RouteAlertBadges } from "@/components/RouteAlertBadges";
import { useAllRouteHistory } from "@/hooks/useRouteHistory";
import { useRouteIntelligence } from "@/hooks/useRouteIntelligence";
import { formatLastUpdated } from "@/lib/format";
import {
  exportSnapshotsAsJson,
  loadAllSnapshots,
} from "@/lib/localRouteHistory";
import {
  createDefaultAlertPreferences,
  evaluateRouteAlerts,
  type RouteAlertPreferences,
} from "@/lib/routeAlerts";
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
  alertPreferences: RouteAlertPreferences;
  onSelect: (routeId: string) => void;
}

function DashboardRouteItem({
  route,
  alertPreferences,
  onSelect,
}: DashboardRouteItemProps): React.ReactElement {
  const { arrivalsQuery, intelligence } = useRouteIntelligence(route.routeId);
  const summary = intelligence?.dashboardSummary;
  const metrics = intelligence?.metrics;

  const userAlerts =
    metrics !== undefined
      ? evaluateRouteAlerts(metrics, alertPreferences)
      : [];

  if (!summary) {
    return (
      <button
        type="button"
        onClick={() => onSelect(route.routeId)}
        className="flex min-w-0 flex-1 flex-col gap-1 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-left hover:border-sky-500/50 sm:min-w-[220px] sm:flex-none"
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
      className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-left hover:border-sky-500/50 sm:min-w-[220px] sm:flex-none"
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
      <RouteAlertBadges alerts={userAlerts} compact />
      <p className="text-xs text-zinc-500">
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
  alertPreferences: Record<string, RouteAlertPreferences>;
}

function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function MultiRouteDashboard({
  activeRoutes,
  alertPreferences,
}: MultiRouteDashboardProps): React.ReactElement | null {
  const { clearAll } = useAllRouteHistory();

  if (activeRoutes.length < 2) {
    return null;
  }

  const handleSelect = (routeId: string) => {
    const element = document.getElementById(`route-card-${routeId}`);
    element?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Live route dashboard
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                downloadTextFile(
                  "all-route-history.json",
                  exportSnapshotsAsJson(loadAllSnapshots()),
                  "application/json",
                )
              }
              className="min-h-11 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Export all JSON
            </button>
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    "Clear all local route history on this device?",
                  )
                ) {
                  clearAll();
                }
              }}
              className="min-h-11 rounded-lg border border-red-300 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
            >
              Clear all history
            </button>
            <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Auto-refreshing
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:overflow-x-auto">
          {activeRoutes.map((route) => (
            <DashboardRouteItem
              key={route.routeId}
              route={route}
              alertPreferences={
                alertPreferences[route.routeId] ??
                createDefaultAlertPreferences(route.routeId)
              }
              onSelect={handleSelect}
            />
          ))}
        </div>
      </div>

      <MultiRouteHistoryComparison activeRoutes={activeRoutes} />
    </div>
  );
}
