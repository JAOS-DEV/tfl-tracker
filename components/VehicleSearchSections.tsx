"use client";

import { VehicleSearchEmptyState } from "@/components/VehicleSearchEmptyState";
import { VehicleSearchResultRow } from "@/components/VehicleSearchResultRow";
import {
  VEHICLE_SEARCH_LIVE_VEHICLES_GROUP_LABEL,
  VEHICLE_SEARCH_RUNNING_NUMBERS_GROUP_LABEL,
  shouldShowVehicleSearchEmptyState,
  type VehicleSearchResult,
} from "@/lib/vehicleSearch";

interface VehicleSearchSectionsProps {
  normalizedQuery: string;
  activeRouteCount: number;
  liveVehicles: VehicleSearchResult[];
  runningNumbers: VehicleSearchResult[];
  showEmptyState: boolean;
  routeDiscoveryResultCount?: number;
  onOpen: (result: VehicleSearchResult) => void;
}

export function VehicleSearchSections({
  normalizedQuery,
  activeRouteCount,
  liveVehicles,
  runningNumbers,
  showEmptyState,
  routeDiscoveryResultCount = 0,
  onOpen,
}: VehicleSearchSectionsProps): React.ReactElement | null {
  const hasResults = liveVehicles.length > 0 || runningNumbers.length > 0;
  const shouldShowEmpty =
    showEmptyState &&
    shouldShowVehicleSearchEmptyState(
      normalizedQuery,
      activeRouteCount,
      liveVehicles.length + runningNumbers.length,
      { routeDiscoveryResultCount },
    );

  if (!hasResults && !shouldShowEmpty) {
    return null;
  }

  return (
    <div className="space-y-4">
      {liveVehicles.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {VEHICLE_SEARCH_LIVE_VEHICLES_GROUP_LABEL} ({liveVehicles.length})
          </p>
          {liveVehicles.map((result) => (
            <VehicleSearchResultRow
              key={`live-${result.routeId}-${result.vehicleId}-${result.kind}`}
              result={result}
              onOpen={onOpen}
            />
          ))}
        </div>
      ) : null}

      {runningNumbers.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {VEHICLE_SEARCH_RUNNING_NUMBERS_GROUP_LABEL} ({runningNumbers.length})
          </p>
          {/^\d{1,4}$/.test(normalizedQuery) ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Run {normalizedQuery} found on:
            </p>
          ) : null}
          {runningNumbers.map((result) => (
            <VehicleSearchResultRow
              key={`run-${result.routeId}-${result.vehicleId}`}
              result={result}
              onOpen={onOpen}
            />
          ))}
        </div>
      ) : null}

      {shouldShowEmpty ? (
        <VehicleSearchEmptyState
          query={normalizedQuery}
          activeRouteCount={activeRouteCount}
        />
      ) : null}
    </div>
  );
}
