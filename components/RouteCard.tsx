"use client";

import { useEffect, useMemo, useState } from "react";
import { ErrorState } from "@/components/ErrorState";
import { RouteCardSkeleton } from "@/components/LoadingSkeleton";
import { RouteDiagram } from "@/components/RouteDiagram";
import { RouteSummary } from "@/components/RouteSummary";
import { StatusBanner } from "@/components/StatusBanner";
import { StopArrivalsModal } from "@/components/StopArrivalsModal";
import { useLineArrivals } from "@/hooks/useLineArrivals";
import { useLineStatus } from "@/hooks/useLineStatus";
import { useRouteSequence } from "@/hooks/useRouteSequence";
import { formatCountdown, formatLastUpdated } from "@/lib/format";
import {
  getDestinationSummary,
  predictionsForDirection,
} from "@/lib/tfl/normalizers";
import type { ActiveRoute, NormalizedStop, RouteDirection } from "@/lib/tfl/types";
import { POLL_INTERVAL_MS } from "@/lib/storage";

interface RouteCardProps {
  activeRoute: ActiveRoute;
  onRemove: (routeId: string) => void;
}

export function RouteCard({
  activeRoute,
  onRemove,
}: RouteCardProps): React.ReactElement {
  const [direction, setDirection] = useState<RouteDirection>("outbound");
  const [selectedStop, setSelectedStop] = useState<NormalizedStop | null>(null);
  const [now, setNow] = useState(() => new Date());

  const sequenceQuery = useRouteSequence(activeRoute.routeId);
  const arrivalsQuery = useLineArrivals(activeRoute.routeId);
  const statusQuery = useLineStatus(activeRoute.routeId);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const route = sequenceQuery.data;

  const directionPredictions = useMemo(() => {
    if (!route) {
      return [];
    }
    const predictions = arrivalsQuery.data?.predictions ?? [];
    const stops = direction === "inbound" ? route.inbound : route.outbound;
    return predictionsForDirection(
      predictions,
      stops.map((stop) => stop.naptanId),
    );
  }, [route, arrivalsQuery.data?.predictions, direction]);

  const nextRefreshAt = useMemo(() => {
    if (!arrivalsQuery.dataUpdatedAt) {
      return null;
    }
    return new Date(arrivalsQuery.dataUpdatedAt + POLL_INTERVAL_MS);
  }, [arrivalsQuery.dataUpdatedAt]);

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

  const destinationSummary = getDestinationSummary(route, direction);

  return (
    <>
      <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 px-4 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-sky-600 px-3 py-1 text-lg font-bold text-white">
                  {activeRoute.routeId}
                </span>
                <div>
                  <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {route.routeName}
                  </h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {destinationSummary}
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onRemove(activeRoute.routeId)}
              className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Remove
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span
              className={`rounded-full px-2 py-1 ${
                arrivalsQuery.isFetching
                  ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200"
                  : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              {arrivalsQuery.isFetching ? "Refreshing…" : "Live"}
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
          </div>

          <div className="mt-3 inline-flex rounded-lg border border-zinc-200 p-1 dark:border-zinc-700">
            {(["outbound", "inbound"] as RouteDirection[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setDirection(value)}
                className={`rounded-md px-3 py-1.5 text-sm capitalize ${
                  direction === value
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </header>

        <div className="space-y-4 p-4">
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

          <RouteSummary predictions={directionPredictions} />

          <RouteDiagram
            route={route}
            direction={direction}
            predictions={arrivalsQuery.data?.predictions ?? []}
            onStopSelect={setSelectedStop}
          />
        </div>
      </article>

      <StopArrivalsModal
        stop={selectedStop}
        routeId={activeRoute.routeId}
        onClose={() => setSelectedStop(null)}
      />
    </>
  );
}
