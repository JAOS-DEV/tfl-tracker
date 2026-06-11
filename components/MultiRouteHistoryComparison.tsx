"use client";

import { useMemo } from "react";
import { useAllRouteHistory } from "@/hooks/useRouteHistory";
import { formatLastUpdated } from "@/lib/format";
import { buildComparisonRows } from "@/lib/localRouteHistory";
import type { ActiveRoute } from "@/lib/tfl/types";

interface MultiRouteHistoryComparisonProps {
  activeRoutes: ActiveRoute[];
}

export function MultiRouteHistoryComparison({
  activeRoutes,
}: MultiRouteHistoryComparisonProps): React.ReactElement | null {
  const { snapshots, hydrated } = useAllRouteHistory();

  const rows = useMemo(
    () =>
      buildComparisonRows(
        snapshots,
        activeRoutes.map((route) => route.routeId),
      ),
    [snapshots, activeRoutes],
  );

  if (activeRoutes.length < 2) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Today&apos;s local history comparison
      </p>
      <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
        Based only on times this app was open on this device. Today uses your
        local calendar day. Detections are counted from saved snapshots, so the
        same real-world issue may be counted more than once.
      </p>

      {!hydrated ? (
        <p className="text-sm text-zinc-500">Loading history…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="text-zinc-500">
                <th className="px-2 py-1 font-medium">Route</th>
                <th className="px-2 py-1 font-medium">Snapshots today</th>
                <th className="px-2 py-1 font-medium">Avg health today</th>
                <th className="px-2 py-1 font-medium">Worst health today</th>
                <th className="px-2 py-1 font-medium">Worst gap today</th>
                <th className="px-2 py-1 font-medium">Bunching detections</th>
                <th className="px-2 py-1 font-medium">Large gap detections</th>
                <th className="px-2 py-1 font-medium">Last snapshot</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.routeId}
                  className="border-t border-zinc-200 dark:border-zinc-800"
                >
                  <td className="px-2 py-2 font-semibold text-zinc-900 dark:text-zinc-100">
                    {row.routeId}
                  </td>
                  <td className="px-2 py-2 text-zinc-600 dark:text-zinc-300">
                    {row.snapshotCount}
                  </td>
                  <td className="px-2 py-2 text-zinc-600 dark:text-zinc-300">
                    {row.averageHealthScore ?? "—"}
                  </td>
                  <td className="px-2 py-2 text-zinc-600 dark:text-zinc-300">
                    {row.worstHealthScore ?? "—"}
                  </td>
                  <td className="px-2 py-2 text-zinc-600 dark:text-zinc-300">
                    {row.worstLargestGapMinutes !== null
                      ? `${row.worstLargestGapMinutes} min`
                      : "—"}
                  </td>
                  <td className="px-2 py-2 text-zinc-600 dark:text-zinc-300">
                    {row.totalBunchingEvents}
                  </td>
                  <td className="px-2 py-2 text-zinc-600 dark:text-zinc-300">
                    {row.totalLargeGapEvents}
                  </td>
                  <td className="px-2 py-2 text-zinc-600 dark:text-zinc-300">
                    {row.lastSnapshotAt
                      ? formatLastUpdated(new Date(row.lastSnapshotAt))
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
