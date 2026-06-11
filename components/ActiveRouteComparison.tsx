"use client";

import { StatusPill } from "@/components/StatusPill";
import { useRouteIntelligence } from "@/hooks/useRouteIntelligence";
import { buildActiveRouteComparison } from "@/lib/activeRouteComparison";
import { MAX_ACTIVE_ROUTES } from "@/lib/storage";
import type { ActiveRoute, RouteDashboardSummary } from "@/lib/tfl/types";

interface ActiveRouteComparisonProps {
  activeRoutes: ActiveRoute[];
}

function healthVariant(
  score: number,
): "good" | "info" | "warning" | "danger" {
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

function ComparisonEntryCard({
  entry,
}: {
  entry: RouteDashboardSummary;
}): React.ReactElement {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-lg bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
          {entry.routeId}
        </span>
        <StatusPill
          label={`${entry.healthLabel} ${entry.healthScore}`}
          variant={healthVariant(entry.healthScore)}
          size="sm"
        />
      </div>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
        {entry.liveVehicleCount} live
        {entry.largestGapMinutes !== null
          ? ` · gap ${entry.largestGapMinutes} min`
          : ""}
        {entry.estimatedLateCount > 0 ? ` · ${entry.estimatedLateCount} late` : ""}
        {entry.possibleGhostCount > 0
          ? ` · ${entry.possibleGhostCount} ghost`
          : ""}
      </p>
    </div>
  );
}

function useFixedRouteSummaries(
  activeRoutes: ActiveRoute[],
): RouteDashboardSummary[] {
  const slotIds = Array.from({ length: MAX_ACTIVE_ROUTES }, (_, index) =>
    activeRoutes[index]?.routeId ?? "",
  );

  const first = useRouteIntelligence(slotIds[0] ?? "");
  const second = useRouteIntelligence(slotIds[1] ?? "");
  const third = useRouteIntelligence(slotIds[2] ?? "");
  const intelligences = [first, second, third];

  return activeRoutes
    .map((route, index) => intelligences[index]?.intelligence?.dashboardSummary)
    .filter((summary): summary is RouteDashboardSummary => summary !== undefined);
}

export function ActiveRouteComparison({
  activeRoutes,
}: ActiveRouteComparisonProps): React.ReactElement | null {
  const summaries = useFixedRouteSummaries(activeRoutes);

  if (activeRoutes.length < 2) {
    return null;
  }

  if (summaries.length < 2) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Active route comparison
        </p>
        <p className="mt-2 text-sm text-zinc-500">Loading comparison…</p>
      </div>
    );
  }

  const comparison = buildActiveRouteComparison(summaries);
  if (!comparison) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Active route comparison
      </p>

      {comparison.bestRouteId ? (
        <div className="mt-2 rounded-xl bg-sky-50 px-3 py-2 dark:bg-sky-950/30">
          <p className="text-sm font-semibold text-sky-900 dark:text-sky-100">
            Best active option right now: {comparison.bestRouteId}
          </p>
          {comparison.bestReason ? (
            <p className="mt-1 text-xs text-sky-800 dark:text-sky-200">
              {comparison.bestReason.charAt(0).toUpperCase()}
              {comparison.bestReason.slice(1)}.
            </p>
          ) : null}
        </div>
      ) : null}

      {comparison.largestGapRouteId ? (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Largest gap among active routes: {comparison.largestGapRouteId}
        </p>
      ) : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {summaries.map((summary) => (
          <ComparisonEntryCard key={summary.routeId} entry={summary} />
        ))}
      </div>
    </div>
  );
}
