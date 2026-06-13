"use client";

import { ActiveRouteComparison } from "@/components/ActiveRouteComparison";
import { MultiRouteHistoryComparison } from "@/components/MultiRouteHistoryComparison";
import { StatusPill } from "@/components/StatusPill";
import { useActiveRouteIntelligences } from "@/hooks/useRouteIntelligence";
import { possibleGhostCountLabel } from "@/lib/ghostDisplay";
import {
  createRouteAlertPreferences,
  type DisplaySettings,
} from "@/lib/displaySettings";
import {
  evaluateRouteAlerts,
  type RouteAlertPreferences,
} from "@/lib/routeAlerts";
import type {
  ActiveRoute,
  RouteDashboardSummary,
  RouteIntelligenceResult,
} from "@/lib/tfl/types";

function healthVariant(score: number): "good" | "info" | "warning" | "danger" {
  if (score >= 85) {
    return "good";
  }
  if (score >= 65) {
    return "info";
  }
  if (score >= 40) {
    return "warning";
  }
  return "danger";
}

function compactAlertLabel(summary: RouteDashboardSummary | undefined): string | null {
  if (!summary) {
    return null;
  }
  if (summary.possibleGhostCount > 0) {
    return possibleGhostCountLabel(summary.possibleGhostCount);
  }
  if (summary.estimatedLateCount > 0) {
    return `${summary.estimatedLateCount} late`;
  }
  if (summary.largeGapCount > 0) {
    return "Large gap";
  }
  if (summary.isDataStale) {
    return "Stale";
  }
  return null;
}

interface DashboardRouteItemProps {
  route: ActiveRoute;
  intelligence: RouteIntelligenceResult | null;
  alertPreferences?: RouteAlertPreferences;
  compact: boolean;
  globalAlertDefaults: DisplaySettings["globalAlertDefaults"];
  onSelect: (routeId: string) => void;
}

function DashboardRouteItem({
  route,
  intelligence,
  alertPreferences,
  compact,
  globalAlertDefaults,
  onSelect,
}: DashboardRouteItemProps): React.ReactElement {
  const summary = intelligence?.dashboardSummary;
  const metrics = intelligence?.metrics;

  const resolvedPreferences =
    alertPreferences ??
    createRouteAlertPreferences(route.routeId, globalAlertDefaults);

  const userAlerts =
    metrics !== undefined
      ? evaluateRouteAlerts(metrics, resolvedPreferences)
      : [];

  const topAlert = userAlerts[0]?.label ?? compactAlertLabel(summary);

  if (!summary) {
    return (
      <button
        type="button"
        onClick={() => onSelect(route.routeId)}
        className="flex min-w-[140px] shrink-0 flex-col gap-1 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-left hover:border-sky-400 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-sky-500"
      >
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
            {route.routeId}
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Loading…
          </span>
        </div>
      </button>
    );
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => onSelect(route.routeId)}
        className="flex min-w-[160px] shrink-0 flex-col gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-left hover:border-sky-400 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-sky-500"
      >
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
            {route.routeId}
          </span>
          <StatusPill
            label={`${summary.healthLabel} ${summary.healthScore}`}
            variant={healthVariant(summary.healthScore)}
            size="sm"
          />
        </div>
        <p className="text-xs text-zinc-600 dark:text-zinc-300">
          {summary.liveVehicleCount} live
          {topAlert ? ` · ${topAlert}` : ""}
        </p>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(route.routeId)}
      className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-left hover:border-sky-400 sm:min-w-[220px] sm:flex-none dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-sky-500"
    >
      <div className="flex items-center gap-2">
        <span className="rounded-lg bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
          {route.routeId}
        </span>
        <StatusPill
          label={`${summary.healthLabel} ${summary.healthScore}/100`}
          variant={healthVariant(summary.healthScore)}
          size="sm"
        />
      </div>
      <p className="text-xs text-zinc-600 dark:text-zinc-300">
        {summary.liveVehicleCount} live
        {summary.largestGapMinutes !== null
          ? ` · gap ${summary.largestGapMinutes} min`
          : ""}
        {summary.possibleGhostCount > 0
          ? ` · ${possibleGhostCountLabel(summary.possibleGhostCount)}`
          : ""}
        {summary.estimatedLateCount > 0
          ? ` · ${summary.estimatedLateCount} late`
          : ""}
      </p>
      {topAlert ? (
        <StatusPill label={topAlert} variant="warning" size="sm" />
      ) : null}
    </button>
  );
}

interface MultiRouteDashboardProps {
  activeRoutes: ActiveRoute[];
  alertPreferences: Record<string, RouteAlertPreferences>;
  displaySettings: DisplaySettings;
  anyRouteExpanded: boolean;
}

export function MultiRouteDashboard({
  activeRoutes,
  alertPreferences,
  displaySettings,
  anyRouteExpanded,
}: MultiRouteDashboardProps): React.ReactElement | null {
  const showDiagnostics = displaySettings.showAdvancedDiagnostics;
  const routeIntelligences = useActiveRouteIntelligences(activeRoutes, {
    includeScheduleMatching: anyRouteExpanded,
    fetchTimetable: anyRouteExpanded,
    showScheduleGhosts: displaySettings.showScheduleGhosts,
    includeLowConfidenceScheduleGhosts: showDiagnostics,
  });
  const summaries = routeIntelligences
    .map((entry) => entry.intelligence?.dashboardSummary)
    .filter((summary): summary is RouteDashboardSummary => summary !== undefined);

  if (activeRoutes.length < 2) {
    return null;
  }

  const handleSelect = (routeId: string) => {
    const element = document.getElementById(`route-card-${routeId}`);
    element?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-3">
      <ActiveRouteComparison summaries={summaries} />

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Active routes
          </p>
          {showDiagnostics ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Auto-refreshing
            </span>
          ) : null}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {activeRoutes.map((route, index) => (
            <DashboardRouteItem
              key={route.routeId}
              route={route}
              intelligence={routeIntelligences[index]?.intelligence ?? null}
              alertPreferences={alertPreferences[route.routeId]}
              globalAlertDefaults={displaySettings.globalAlertDefaults}
              compact={!showDiagnostics}
              onSelect={handleSelect}
            />
          ))}
        </div>
      </div>

      {showDiagnostics ? (
        <MultiRouteHistoryComparison activeRoutes={activeRoutes} />
      ) : null}
    </div>
  );
}
