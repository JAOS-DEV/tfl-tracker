"use client";

import { BusChip } from "@/components/BusChip";
import { ErrorState } from "@/components/ErrorState";
import { MobileBottomSheet } from "@/components/MobileBottomSheet";
import { useStopArrivals } from "@/hooks/useStopArrivals";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { formatFriendlyError } from "@/lib/errors";
import { formatLastUpdated } from "@/lib/format";
import { analyzeStopPredictions } from "@/lib/serviceIntelligence";
import type { EstimatedVehiclePosition, NormalizedStop } from "@/lib/tfl/types";

interface StopArrivalsModalProps {
  stop: NormalizedStop | null;
  routeId: string;
  vehicles?: EstimatedVehiclePosition[];
  onClose: () => void;
}

export function StopArrivalsModal({
  stop,
  routeId,
  vehicles = [],
  onClose,
}: StopArrivalsModalProps): React.ReactElement | null {
  const isOnline = useOnlineStatus();
  const stopPointId = stop?.naptanId ?? null;
  const { data, isLoading, isError, error, refetch, dataUpdatedAt } =
    useStopArrivals(stopPointId);

  if (!stop) {
    return null;
  }

  const vehicleById = new Map(
    vehicles.map((vehicle) => [vehicle.vehicleId, vehicle]),
  );

  const routePredictions =
    data?.predictions.filter(
      (prediction) =>
        prediction.routeId === routeId ||
        prediction.routeNumber === routeId,
    ) ?? [];
  const otherPredictions =
    data?.predictions.filter(
      (prediction) =>
        prediction.routeId !== routeId &&
        prediction.routeNumber !== routeId,
    ) ?? [];

  const stopAnalysis = analyzeStopPredictions(routePredictions);
  const friendlyError = isError
    ? formatFriendlyError(error, { isOffline: !isOnline })
    : null;

  return (
    <MobileBottomSheet
      title={stop.name}
      titleId="stop-arrivals-title"
      onClose={onClose}
      footer={
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {stop.naptanId} · Last updated{" "}
          {formatLastUpdated(new Date(dataUpdatedAt))} · Estimated from TfL
          live arrival data
        </p>
      }
    >
      {isLoading ? (
        <p className="text-sm text-zinc-500">Loading arrivals…</p>
      ) : null}

      {friendlyError ? (
        <ErrorState
          title={friendlyError.title}
          message={friendlyError.message}
          action={friendlyError.action}
          onRetry={() => {
            void refetch();
          }}
        />
      ) : null}

      {!isLoading && !isError && routePredictions.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No upcoming buses predicted for route {routeId} at this stop.
        </p>
      ) : null}

      {!isLoading && !isError && routePredictions.length > 0 ? (
        <div className="space-y-3">
          {stopAnalysis.hasPossibleBunching ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              Possible bunching — multiple buses predicted within a few minutes
              at this stop.
            </p>
          ) : null}
          {stopAnalysis.hasLargeGap ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              Large predicted gap — a longer wait may be likely between
              arrivals.
            </p>
          ) : null}

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Route {routeId}
            </p>
            {stopAnalysis.sortedPredictions.map((prediction) => (
              <BusChip
                key={prediction.id}
                prediction={prediction}
                vehicle={
                  prediction.vehicleId
                    ? vehicleById.get(prediction.vehicleId)
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      ) : null}

      {!isLoading && !isError && otherPredictions.length > 0 ? (
        <div className="mt-4 space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Other routes at this stop
          </p>
          {otherPredictions.map((prediction) => (
            <BusChip
              key={prediction.id}
              prediction={prediction}
              muted
            />
          ))}
        </div>
      ) : null}
    </MobileBottomSheet>
  );
}
