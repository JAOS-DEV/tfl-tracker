"use client";

import {
  buildVehicleSearchEmptyState,
  type VehicleSearchEmptyStateContent,
} from "@/lib/vehicleSearch";

interface VehicleSearchEmptyStateProps {
  query: string;
  activeRouteCount: number;
  content?: VehicleSearchEmptyStateContent;
}

export function VehicleSearchEmptyState({
  query,
  activeRouteCount,
  content,
}: VehicleSearchEmptyStateProps): React.ReactElement {
  const message = content ?? buildVehicleSearchEmptyState(query, activeRouteCount);

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
      <p>{message.title}</p>
      {message.detail ? (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {message.detail}
        </p>
      ) : null}
      {message.hint ? (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          {message.hint}
        </p>
      ) : null}
    </div>
  );
}
