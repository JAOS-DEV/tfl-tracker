"use client";

import { ErrorState } from "@/components/ErrorState";
import { MobileBottomSheet } from "@/components/MobileBottomSheet";
import { StopDisruptionBanner } from "@/components/StopDisruptionBanner";
import { ShareLinkButton } from "@/components/ShareLinkButton";
import { StopArrivalRow } from "@/components/StopArrivalRow";
import { useStopArrivals } from "@/hooks/useStopArrivals";
import { useStopDisruptions } from "@/hooks/useStopDisruptions";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { formatFriendlyError } from "@/lib/errors";
import { formatLastUpdated } from "@/lib/format";
import { groupArrivalsByRoute } from "@/lib/stopArrivalsGrouping";
import { buildStopSearchUrl } from "@/lib/routeUrl";
import type { StopDetailTarget } from "@/lib/stopDetail";
import { analyzeStopPredictions } from "@/lib/serviceIntelligence";
import type { EstimatedVehiclePosition, StopDisruption } from "@/lib/tfl/types";

interface StopArrivalsModalProps {
  stop: StopDetailTarget | null;
  stopDisruption?: StopDisruption;
  activeRouteIds?: string[];
  highlightRouteId?: string;
  vehicles?: EstimatedVehiclePosition[];
  isFavourite?: boolean;
  onToggleFavourite?: () => void;
  onAddRoute?: (routeId: string, routeName: string) => void;
  onClose: () => void;
}

export function StopArrivalsModal({
  stop,
  stopDisruption,
  activeRouteIds = [],
  highlightRouteId,
  vehicles = [],
  isFavourite = false,
  onToggleFavourite,
  onAddRoute,
  onClose,
}: StopArrivalsModalProps): React.ReactElement | null {
  const isOnline = useOnlineStatus();
  const stopPointId = stop?.stopPointId ?? null;
  const { data, isLoading, isError, error, refetch, dataUpdatedAt, isFetching } =
    useStopArrivals(stopPointId);
  const stopDisruptionsQuery = useStopDisruptions(
    stopDisruption || !stopPointId ? [] : [stopPointId],
  );
  const resolvedStopDisruption =
    stopDisruption ?? stopDisruptionsQuery.data?.[0];

  if (!stop) {
    return null;
  }

  const vehicleById = new Map(
    vehicles.map((vehicle) => [vehicle.vehicleId, vehicle]),
  );

  const groupedArrivals = groupArrivalsByRoute(
    data?.predictions ?? [],
    activeRouteIds,
  );

  const highlightedGroups = groupedArrivals.filter((group) => group.isActiveRoute);
  const otherGroups = groupedArrivals.filter((group) => !group.isActiveRoute);
  const allHighlightedPredictions = highlightedGroups.flatMap(
    (group) => group.predictions,
  );
  const stopAnalysis = analyzeStopPredictions(allHighlightedPredictions);
  const friendlyError = isError
    ? formatFriendlyError(error, { isOffline: !isOnline })
    : null;

  const shareUrl =
    typeof window !== "undefined"
      ? new URL(buildStopSearchUrl(stop.stopPointId), window.location.origin).toString()
      : buildStopSearchUrl(stop.stopPointId);

  const title = stop.stopLetter
    ? `${stop.name} (${stop.stopLetter})`
    : stop.name;

  return (
    <MobileBottomSheet
      title={title}
      titleId="stop-arrivals-title"
      onClose={onClose}
      footer={
        <div className="space-y-2">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {stop.stopPointId} · Last updated{" "}
            {formatLastUpdated(new Date(dataUpdatedAt))}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Estimated from TfL live arrival data
          </p>
        </div>
      }
    >
      {resolvedStopDisruption ? (
        <div className="mb-4">
          <StopDisruptionBanner disruption={resolvedStopDisruption} />
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {onToggleFavourite ? (
          <button
            type="button"
            onClick={onToggleFavourite}
            className={`min-h-11 rounded-lg px-3 py-2 text-sm font-medium ${
              isFavourite
                ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100"
                : "border border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
            }`}
          >
            {isFavourite ? "★ Favourited" : "☆ Favourite stop"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            void refetch();
          }}
          disabled={isFetching}
          className="min-h-11 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {isFetching ? "Refreshing…" : "Refresh"}
        </button>
        <ShareLinkButton url={shareUrl} label="Copy stop link" />
      </div>

      {isLoading ? (
        <p className="text-sm text-zinc-500">Loading arrivals…</p>
      ) : null}

      {friendlyError ? (
        <ErrorState
          title={friendlyError.title}
          message={friendlyError.message}
          action={friendlyError.action ?? "TfL data may be temporarily unavailable."}
          onRetry={() => {
            void refetch();
          }}
        />
      ) : null}

      {!isLoading && !isError && groupedArrivals.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No arrivals right now.
        </p>
      ) : null}

      {!isLoading && !isError && groupedArrivals.length > 0 ? (
        <div className="space-y-4">
          {stopAnalysis.hasPossibleBunching ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              Possible bunching — multiple buses predicted within a few minutes.
            </p>
          ) : null}
          {stopAnalysis.hasLargeGap ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              Large predicted gap — a longer wait may be likely between arrivals.
            </p>
          ) : null}

          {highlightedGroups.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                Active dashboard routes
              </p>
              {highlightedGroups.map((group) => (
                <div key={group.routeNumber} className="space-y-2">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Route {group.routeNumber}
                  </p>
                  {group.predictions.map((prediction) => (
                    <StopArrivalRow
                      key={prediction.id}
                      prediction={prediction}
                      vehicle={
                        prediction.vehicleId
                          ? vehicleById.get(prediction.vehicleId)
                          : undefined
                      }
                      highlighted={
                        highlightRouteId === group.routeNumber ||
                        highlightRouteId === group.routeId
                      }
                      onAddRoute={onAddRoute}
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : null}

          {otherGroups.length > 0 ? (
            <div className="space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Other routes
              </p>
              {otherGroups.map((group) => (
                <div key={group.routeNumber} className="space-y-2">
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Route {group.routeNumber}
                  </p>
                  {group.predictions.map((prediction) => (
                    <StopArrivalRow
                      key={prediction.id}
                      prediction={prediction}
                      onAddRoute={onAddRoute}
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </MobileBottomSheet>
  );
}
