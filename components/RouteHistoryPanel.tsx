"use client";

import { useState } from "react";
import { RouteHistoryChart } from "@/components/RouteHistoryChart";
import { useRouteHistory } from "@/hooks/useRouteHistory";

interface RouteHistoryPanelProps {
  routeId: string;
  defaultExpanded?: boolean;
  showHeader?: boolean;
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

export function RouteHistoryPanel({
  routeId,
  defaultExpanded = false,
  showHeader = true,
}: RouteHistoryPanelProps): React.ReactElement {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const { snapshots, dailyStats, hydrated, clearRoute, exportJson, exportCsv } =
    useRouteHistory(routeId);

  const healthValues = snapshots.map((snapshot) => snapshot.healthScore);
  const gapValues = snapshots.map(
    (snapshot) => snapshot.largestGapMinutes ?? 0,
  );
  const vehicleValues = snapshots.map(
    (snapshot) => snapshot.liveVehicleCount,
  );

  const isExpanded = defaultExpanded ? true : expanded;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      {showHeader ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Local performance history
            </h3>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              History is stored locally on this device and only covers periods
              when this app was open. Service health is an estimate based on TfL
              live prediction data. It is not an official TfL score.
            </p>
          </div>
          {!defaultExpanded ? (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {expanded ? "Hide" : "Show"}
            </button>
          ) : null}
        </div>
      ) : null}

      {!hydrated ? (
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          Loading local history…
        </p>
      ) : null}

      {hydrated && dailyStats.snapshotCount === 0 ? (
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          No snapshots recorded for this route yet today.
        </p>
      ) : null}

      {hydrated && dailyStats.snapshotCount > 0 && isExpanded ? (
        <div className="mt-3 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Today
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Snapshots today
              </p>
              <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {dailyStats.snapshotCount}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Best / worst health today
              </p>
              <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {dailyStats.bestHealthScore} / {dailyStats.worstHealthScore}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Avg health today
              </p>
              <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {dailyStats.averageHealthScore}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Worst gap today
              </p>
              <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {dailyStats.worstLargestGapMinutes !== null
                  ? `${dailyStats.worstLargestGapMinutes} min`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Bunching detections today
              </p>
              <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {dailyStats.totalBunchingEvents}
              </p>
            </div>
          </div>
          <p
            className="text-xs text-zinc-500 dark:text-zinc-400"
            title="Detections are counted from saved snapshots while the app was open, so the same real-world issue may be counted more than once."
          >
            Detections are counted from saved snapshots while the app was open,
            so the same real-world issue may be counted more than once.
          </p>
        </div>
      ) : null}

      {isExpanded && hydrated ? (
        <div className="mt-4 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Last 24 hours
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Charts use all stored snapshots for this route within the 24-hour
            retention window.
          </p>
          <div className="grid gap-3 lg:grid-cols-3">
            <RouteHistoryChart
              title="Health score over time"
              values={healthValues}
              color="#10B981"
            />
            <RouteHistoryChart
              title="Largest gap over time"
              values={gapValues}
              color="#F59E0B"
              unit=" min"
            />
            <RouteHistoryChart
              title="Vehicle count over time"
              values={vehicleValues}
              color="#0EA5E9"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                downloadTextFile(
                  `route-${routeId}-history.json`,
                  exportJson(),
                  "application/json",
                )
              }
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Export JSON
            </button>
            <button
              type="button"
              onClick={() =>
                downloadTextFile(
                  `route-${routeId}-history.csv`,
                  exportCsv(),
                  "text/csv",
                )
              }
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    `Clear local history for route ${routeId}?`,
                  )
                ) {
                  clearRoute();
                }
              }}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
            >
              Clear route history
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
