"use client";

import { useMemo, useState } from "react";
import { BusDetailsModal } from "@/components/BusDetailsModal";
import { ErrorState } from "@/components/ErrorState";
import { RouteCardSkeleton } from "@/components/LoadingSkeleton";
import { RouteDiagram } from "@/components/RouteDiagram";
import { RouteHistoryPanel } from "@/components/RouteHistoryPanel";
import { ServiceHealthCard } from "@/components/ServiceHealthCard";
import { useRouteHistoryRecorder } from "@/hooks/useRouteHistoryRecorder";
import { useRouteIntelligence } from "@/hooks/useRouteIntelligence";
import { RouteVisualModeToggle } from "@/components/RouteVisualModeToggle";
import { SchematicRouteLoop } from "@/components/SchematicRouteLoop";
import { StatusBanner } from "@/components/StatusBanner";
import { StopArrivalsModal } from "@/components/StopArrivalsModal";
import { useLineStatus } from "@/hooks/useLineStatus";
import { formatCountdown, formatLastUpdated } from "@/lib/format";
import { getDestinationSummary } from "@/lib/tfl/normalizers";
import { getDirectionLabel } from "@/lib/routePositioning";
import type {
  ActiveRoute,
  EstimatedVehiclePosition,
  NormalizedStop,
  RouteVisualMode,
} from "@/lib/tfl/types";
import { POLL_INTERVAL_MS } from "@/lib/storage";

interface RouteCardProps {
  activeRoute: ActiveRoute;
  onRemove: (routeId: string) => void;
  isFavourite: boolean;
  onToggleFavourite: (routeId: string) => void;
}

export function RouteCard({
  activeRoute,
  onRemove,
  isFavourite,
  onToggleFavourite,
}: RouteCardProps): React.ReactElement {
  const [visualMode, setVisualMode] = useState<RouteVisualMode>("loop");
  const [selectedStop, setSelectedStop] = useState<NormalizedStop | null>(null);
  const [selectedVehicle, setSelectedVehicle] =
    useState<EstimatedVehiclePosition | null>(null);
  const {
    route,
    sequenceQuery,
    arrivalsQuery,
    intelligence,
    now,
  } = useRouteIntelligence(activeRoute.routeId);
  const statusQuery = useLineStatus(activeRoute.routeId);

  const vehicles = useMemo(
    () => intelligence?.vehicles ?? [],
    [intelligence?.vehicles],
  );
  const serviceHealth = intelligence?.metrics;

  useRouteHistoryRecorder(
    activeRoute.routeId,
    route?.routeName ?? activeRoute.routeName,
    intelligence,
    arrivalsQuery.dataUpdatedAt,
  );

  const nextRefreshAt = useMemo(() => {
    if (!arrivalsQuery.dataUpdatedAt) {
      return null;
    }
    return new Date(arrivalsQuery.dataUpdatedAt + POLL_INTERVAL_MS);
  }, [arrivalsQuery.dataUpdatedAt]);

  const selectedVehicleWithConfidence = useMemo(() => {
    if (!selectedVehicle) {
      return null;
    }
    return (
      vehicles.find(
        (vehicle) => vehicle.vehicleId === selectedVehicle.vehicleId,
      ) ?? selectedVehicle
    );
  }, [selectedVehicle, vehicles]);

  if (sequenceQuery.isLoading) {
    return <RouteCardSkeleton />;
  }

  if (sequenceQuery.isError || !route) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <ErrorState
          title={`Route ${activeRoute.routeId} unavailable`}
          message={
            sequenceQuery.error?.message ?? "Failed to load route sequence"
          }
          onRetry={() => {
            void sequenceQuery.refetch();
          }}
        />
        <button
          type="button"
          onClick={() => onRemove(activeRoute.routeId)}
          className="mt-3 text-sm text-zinc-500 underline"
        >
          Remove route
        </button>
      </div>
    );
  }

  const outboundSummary = getDestinationSummary(route, "outbound");
  const inboundSummary = getDestinationSummary(route, "inbound");

  return (
    <>
      <article
        id={`route-card-${activeRoute.routeId}`}
        className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 px-4 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-xl bg-red-600 px-4 py-1.5 text-xl font-bold text-white shadow-sm">
                  {activeRoute.routeId}
                </span>
                <div className="min-w-0">
                  <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {route.routeName}
                  </h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {outboundSummary}
                  </p>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <span className="truncate rounded-full bg-sky-100 px-2.5 py-1.5 text-center text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                  {getDirectionLabel(route, "outbound")}
                </span>
                <span className="truncate rounded-full bg-violet-100 px-2.5 py-1.5 text-center text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                  {getDirectionLabel(route, "inbound")}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onToggleFavourite(activeRoute.routeId)}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  isFavourite
                    ? "text-amber-500"
                    : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
                aria-label={
                  isFavourite ? "Remove from favourites" : "Add to favourites"
                }
              >
                {isFavourite ? "★ Favourite" : "☆ Favourite"}
              </button>
              <button
                type="button"
                onClick={() => onRemove(activeRoute.routeId)}
                className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Remove
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 ${
                arrivalsQuery.isFetching
                  ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200"
                  : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              {arrivalsQuery.isFetching ? "Refreshing…" : "Live now"}
            </span>
            <span>
              Last updated{" "}
              {arrivalsQuery.dataUpdatedAt
                ? formatLastUpdated(new Date(arrivalsQuery.dataUpdatedAt))
                : "—"}
            </span>
            {nextRefreshAt ? (
              <span>Next refresh in {formatCountdown(nextRefreshAt, now)}</span>
            ) : null}
            <span className="text-zinc-400">· Estimated positions</span>
          </div>

        </header>

        <div
          className={
            visualMode === "loop" ? "space-y-3 sm:space-y-4" : "space-y-4 p-4"
          }
        >
          <div className={visualMode === "loop" ? "space-y-3 px-3 pt-3 sm:px-4 sm:pt-4" : ""}>
            <StatusBanner status={statusQuery.data} />

            {arrivalsQuery.isError ? (
              <ErrorState
                title="Live arrivals unavailable"
                message={arrivalsQuery.error?.message ?? "Unknown error"}
                onRetry={() => {
                  void arrivalsQuery.refetch();
                }}
              />
            ) : null}

            {serviceHealth ? (
              <ServiceHealthCard
                route={route}
                metrics={serviceHealth}
                compact={visualMode === "loop"}
              />
            ) : null}

            <RouteVisualModeToggle mode={visualMode} onChange={setVisualMode} />

            <RouteHistoryPanel routeId={activeRoute.routeId} />
          </div>

          {visualMode === "loop" ? (
            <SchematicRouteLoop
              route={route}
              vehicles={vehicles}
              onStopSelect={setSelectedStop}
              onBusSelect={setSelectedVehicle}
              selectedStopId={selectedStop?.naptanId ?? null}
              selectedVehicleId={selectedVehicle?.vehicleId ?? null}
            />
          ) : (
            <div className="px-4">
            <div className="space-y-4">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-sky-700 dark:text-sky-300">
                  {getDirectionLabel(route, "outbound")}
                </h3>
                <RouteDiagram
                  route={route}
                  direction="outbound"
                  predictions={arrivalsQuery.data?.predictions ?? []}
                  onStopSelect={setSelectedStop}
                />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-violet-700 dark:text-violet-300">
                  {getDirectionLabel(route, "inbound")}
                </h3>
                <RouteDiagram
                  route={route}
                  direction="inbound"
                  predictions={arrivalsQuery.data?.predictions ?? []}
                  onStopSelect={setSelectedStop}
                />
              </div>
            </div>
            </div>
          )}

          <p
            className={`text-xs text-zinc-500 dark:text-zinc-400 ${
              visualMode === "loop" ? "px-3 pb-3 sm:px-4 sm:pb-4" : ""
            }`}
          >
            Inbound summary: {inboundSummary}. Bus positions are estimated from
            TfL prediction data, not exact GPS.
          </p>
        </div>
      </article>

      <StopArrivalsModal
        stop={selectedStop}
        routeId={activeRoute.routeId}
        onClose={() => setSelectedStop(null)}
      />

      <BusDetailsModal
        vehicle={selectedVehicleWithConfidence}
        onClose={() => setSelectedVehicle(null)}
      />
    </>
  );
}
