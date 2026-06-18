import { useEffect, useMemo, useRef, useState } from "react";
import { StopRow } from "@/components/StopRow";
import { buildStopRowDomId, buildStopRowKey } from "@/lib/listRowKeys";
import {
  buildLiveBusJumpCandidates,
  getJumpButtonLabel,
  pickJumpCandidateOnClick,
  scrollStopRowIntoListContainer,
} from "@/lib/routeListNavigation";
import { predictionsForStop } from "@/lib/tfl/normalizers";
import type {
  EstimatedVehiclePosition,
  NormalizedRoute,
  NormalizedStop,
  NormalizedVehiclePrediction,
  RouteDirection,
  StopDisruption,
} from "@/lib/tfl/types";

interface RouteDiagramProps {
  route: NormalizedRoute;
  direction: RouteDirection;
  predictions: NormalizedVehiclePrediction[];
  vehicles?: EstimatedVehiclePosition[];
  stopDisruptionsByNaptanId?: Map<string, StopDisruption>;
  showTimingPoints?: boolean;
  onStopSelect: (stop: NormalizedStop) => void;
}

function vehiclesAtStop(
  vehicles: EstimatedVehiclePosition[],
  stop: NormalizedStop,
  direction: RouteDirection,
): EstimatedVehiclePosition[] {
  return vehicles.filter(
    (vehicle) =>
      !vehicle.isScheduledGhostCandidate &&
      vehicle.direction === direction &&
      vehicle.nextStop?.naptanId === stop.naptanId,
  );
}

const JUMP_HIGHLIGHT_MS = 1800;

export function RouteDiagram({
  route,
  direction,
  predictions,
  vehicles = [],
  stopDisruptionsByNaptanId,
  showTimingPoints = false,
  onStopSelect,
}: RouteDiagramProps): React.ReactElement {
  const listRef = useRef<HTMLDivElement>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lastJumpedBusRowKey, setLastJumpedBusRowKey] = useState<string | null>(
    null,
  );
  const [highlightedRowKey, setHighlightedRowKey] = useState<string | null>(
    null,
  );
  const stops = direction === "inbound" ? route.inbound : route.outbound;
  const jumpCandidates = useMemo(
    () =>
      buildLiveBusJumpCandidates(route.routeId, direction, stops, vehicles),
    [route.routeId, direction, stops, vehicles],
  );
  const activeLastJumpedRowKey =
    lastJumpedBusRowKey &&
    jumpCandidates.some(
      (candidate) => candidate.rowKey === lastJumpedBusRowKey,
    )
      ? lastJumpedBusRowKey
      : null;
  const jumpButtonLabel = useMemo(
    () => getJumpButtonLabel(jumpCandidates, activeLastJumpedRowKey),
    [jumpCandidates, activeLastJumpedRowKey],
  );

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  const handleJumpToNextBus = (): void => {
    const candidate = pickJumpCandidateOnClick(
      jumpCandidates,
      activeLastJumpedRowKey,
      listRef.current,
    );

    if (!candidate) {
      return;
    }

    scrollStopRowIntoListContainer(listRef.current, candidate.domId);
    setLastJumpedBusRowKey(candidate.rowKey);
    setHighlightedRowKey(candidate.rowKey);

    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }

    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedRowKey(null);
      highlightTimeoutRef.current = null;
    }, JUMP_HIGHLIGHT_MS);
  };

  if (stops.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        No stops found for the {direction} direction.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50/95 px-3 py-2 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {direction === "outbound" ? "Outbound" : "Inbound"}
            </p>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {stops[stops.length - 1]?.name ?? "End of route"}
            </p>
          </div>
          {jumpCandidates.length > 0 ? (
            <button
              type="button"
              onClick={handleJumpToNextBus}
              className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800 transition hover:bg-sky-100 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-200 dark:hover:bg-sky-950"
            >
              {jumpButtonLabel}
            </button>
          ) : (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              No live bus stops to jump to
            </span>
          )}
        </div>
      </div>

      <div ref={listRef} className="max-h-[min(70vh,720px)] overflow-y-auto p-2">
        {stops.map((stop, stopIndex) => {
          const rowKey = buildStopRowKey(
            route.routeId,
            direction,
            stop.id,
            stopIndex,
          );

          return (
            <div
              key={rowKey}
              id={buildStopRowDomId(rowKey)}
              data-stop-row-key={rowKey}
              className={
                highlightedRowKey === rowKey
                  ? "rounded-xl bg-sky-50 ring-2 ring-sky-300 transition dark:bg-sky-950/40 dark:ring-sky-700"
                  : undefined
              }
            >
              <StopRow
                rowKey={rowKey}
                stop={stop}
                predictions={predictionsForStop(predictions, stop.naptanId)}
                vehiclesAtStop={vehiclesAtStop(vehicles, stop, direction)}
                isFirst={stopIndex === 0}
                isLast={stopIndex === stops.length - 1}
                stopDisruption={stopDisruptionsByNaptanId?.get(stop.naptanId)}
                showTimingPoints={showTimingPoints}
                onSelect={onStopSelect}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
