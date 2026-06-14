"use client";

import { useState } from "react";
import { StatusPill } from "@/components/StatusPill";
import { formatGapMinutes } from "@/lib/format";
import { buildActiveRouteComparison } from "@/lib/activeRouteComparison";
import type { RouteDashboardSummary } from "@/lib/tfl/types";

interface ActiveRouteComparisonProps {
  summaries: RouteDashboardSummary[];
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
          ? ` · gap ${formatGapMinutes(entry.largestGapMinutes)} min`
          : ""}
        {entry.estimatedLateCount > 0 ? ` · ${entry.estimatedLateCount} late` : ""}
        {entry.possibleGhostCount > 0
          ? ` · ${entry.possibleGhostCount} ghost`
          : ""}
      </p>
    </div>
  );
}

export function ActiveRouteComparison({
  summaries,
}: ActiveRouteComparisonProps): React.ReactElement | null {
  const [isExpanded, setIsExpanded] = useState(false);

  if (summaries.length < 2) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Active route comparison
          </p>
        </div>
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
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Active route comparison
          </p>
          {!isExpanded && comparison.bestRouteId ? (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Best right now: {comparison.bestRouteId}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
          aria-expanded={isExpanded}
          className="min-h-11 shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {isExpanded ? "Hide" : "Show"}
        </button>
      </div>

      {isExpanded ? (
        <>
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

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {summaries.map((summary) => (
              <ComparisonEntryCard key={summary.routeId} entry={summary} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
