"use client";

import { useMemo } from "react";
import { RouteLoopBusMarker } from "@/components/RouteLoopBusMarker";
import { RouteLoopDirectionChevrons } from "@/components/RouteLoopDirectionChevrons";
import { RouteLoopDirectionGuide } from "@/components/RouteLoopDirectionGuide";
import { RouteLoopStopNode } from "@/components/RouteLoopStopNode";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { LoopLayoutConfig } from "@/lib/constants";
import { getLoopLayout } from "@/lib/constants";
import {
  buildLoopPath,
  buildLoopStops,
  buildVehiclePositions,
  getLoopLegEndpoints,
  mapProgressToLoopCoordinates,
} from "@/lib/routePositioning";
import type {
  EstimatedVehiclePosition,
  LoopStopNode,
  NormalizedRoute,
  NormalizedStop,
  NormalizedVehiclePrediction,
} from "@/lib/tfl/types";

interface SchematicRouteLoopProps {
  route: NormalizedRoute;
  predictions: NormalizedVehiclePrediction[];
  onStopSelect: (stop: NormalizedStop) => void;
  onBusSelect: (vehicle: EstimatedVehiclePosition) => void;
  selectedStopId: string | null;
  selectedVehicleId: string | null;
}

function applyMobileLabels(
  layout: ReturnType<typeof buildLoopStops>,
  nearbyStopIds: Set<string>,
  selectedStopId: string | null,
): ReturnType<typeof buildLoopStops> {
  const enhance = (nodes: LoopStopNode[]) =>
    nodes.map((node) => ({
      ...node,
      shouldLabel:
        node.shouldLabel ||
        nearbyStopIds.has(node.stop.naptanId) ||
        node.stop.naptanId === selectedStopId,
    }));

  return {
    outbound: enhance(layout.outbound),
    inbound: enhance(layout.inbound),
  };
}

function terminalArrow(
  layout: LoopLayoutConfig,
  direction: "outbound" | "inbound",
  endpoints: ReturnType<typeof getLoopLegEndpoints>,
): string {
  const size = 16;

  if (layout.orientation === "portrait") {
    if (direction === "outbound") {
      const { x, y } = endpoints.outboundStart;
      return `${x},${y + size} ${x - size},${y - 4} ${x + size},${y - 4}`;
    }
    const { x, y } = endpoints.inboundEnd;
    return `${x},${y - size} ${x - size},${y + 4} ${x + size},${y + 4}`;
  }

  if (direction === "outbound") {
    const { x, y } = endpoints.outboundEnd;
    return `${x + size},${y} ${x - 4},${y - size} ${x - 4},${y + size}`;
  }
  const { x, y } = endpoints.inboundEnd;
  return `${x - size},${y} ${x + 4},${y - size} ${x + 4},${y + size}`;
}

export function SchematicRouteLoop({
  route,
  predictions,
  onStopSelect,
  onBusSelect,
  selectedStopId,
  selectedVehicleId,
}: SchematicRouteLoopProps): React.ReactElement {
  const isMobile = useMediaQuery("(max-width: 640px)");
  const layout = useMemo(
    () => getLoopLayout(isMobile, route),
    [isMobile, route],
  );
  const markerSize = isMobile ? 40 : 32;

  const vehicles = useMemo(
    () => buildVehiclePositions(predictions, route, layout),
    [predictions, route, layout],
  );

  const nearbyStopIds = useMemo(() => {
    const ids = new Set<string>();
    for (const vehicle of vehicles) {
      if (vehicle.nextStop) {
        ids.add(vehicle.nextStop.naptanId);
      }
    }
    return ids;
  }, [vehicles]);

  const loopStops = useMemo(() => {
    const built = buildLoopStops(route, 8, layout);
    return isMobile
      ? applyMobileLabels(built, nearbyStopIds, selectedStopId)
      : built;
  }, [route, layout, isMobile, nearbyStopIds, selectedStopId]);

  const { topY, bottomY, viewBoxWidth, viewBoxHeight } = layout;
  const legEndpoints = useMemo(
    () => getLoopLegEndpoints(route, layout),
    [route, layout],
  );
  if (route.outbound.length === 0 && route.inbound.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
        No stops available to draw the route loop.
      </div>
    );
  }

  const allNodes: LoopStopNode[] = [...loopStops.outbound, ...loopStops.inbound];
  return (
    <section className="w-full sm:rounded-2xl sm:border sm:border-zinc-200 sm:bg-zinc-50 sm:p-4 dark:sm:border-zinc-800 dark:sm:bg-zinc-950">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs text-zinc-600 sm:px-0 sm:py-0 sm:pb-3 dark:text-zinc-400">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          Live now
        </span>
        <span className="text-sm">
          {vehicles.length} bus{vehicles.length === 1 ? "" : "es"}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap gap-4 px-3 text-sm text-zinc-700 sm:px-0 dark:text-zinc-300">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-emerald-500" />
          On time
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-amber-400" />
          Early
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-red-500" />
          Late
        </span>
      </div>

      <div className="mb-3">
        <RouteLoopDirectionGuide
          route={route}
          orientation={layout.orientation}
        />
      </div>

      <div className="w-full px-1 sm:px-0">
        <svg
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          preserveAspectRatio="xMidYMid meet"
          className="mx-auto block h-auto w-full"
          role="img"
          aria-label={`Schematic loop diagram for route ${route.routeId}`}
        >
          <path
            d={buildLoopPath(route, layout)}
            fill="none"
            stroke="#0EA5E9"
            strokeWidth={isMobile ? 7 : 5}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.95}
          />

          <RouteLoopDirectionChevrons
            layout={layout}
            direction="outbound"
            legStart={legEndpoints.outboundStart}
            legEnd={legEndpoints.outboundEnd}
          />
          <RouteLoopDirectionChevrons
            layout={layout}
            direction="inbound"
            legStart={legEndpoints.inboundEnd}
            legEnd={legEndpoints.inboundStart}
          />

          <polygon
            points={terminalArrow(layout, "outbound", legEndpoints)}
            className="fill-sky-600 dark:fill-sky-300"
          />
          <polygon
            points={terminalArrow(layout, "inbound", legEndpoints)}
            className="fill-violet-600 dark:fill-violet-400"
          />

          <g>
            <rect
              x={viewBoxWidth / 2 - (isMobile ? 44 : 36)}
              y={(topY + bottomY) / 2 - (isMobile ? 24 : 20)}
              width={isMobile ? 88 : 72}
              height={isMobile ? 48 : 40}
              rx={12}
              className="fill-sky-600"
            />
            <text
              x={viewBoxWidth / 2}
              y={(topY + bottomY) / 2 + (isMobile ? 8 : 6)}
              textAnchor="middle"
              fontSize={isMobile ? 24 : 20}
              fontWeight={700}
              className="fill-white"
            >
              {route.routeId}
            </text>
          </g>

          {allNodes.map((node) => {
            const { x, y } = mapProgressToLoopCoordinates(node.progress, layout);
            return (
              <RouteLoopStopNode
                key={`${node.direction}-${node.stop.naptanId}`}
                node={node}
                x={x}
                y={y}
                compact={isMobile}
                orientation={layout.orientation}
                isSelected={selectedStopId === node.stop.naptanId}
                hasNearbyBus={nearbyStopIds.has(node.stop.naptanId)}
                onSelect={() => onStopSelect(node.stop)}
              />
            );
          })}

          {vehicles.map((vehicle) => (
            <RouteLoopBusMarker
              key={vehicle.vehicleId}
              vehicle={vehicle}
              markerSize={markerSize}
              isSelected={selectedVehicleId === vehicle.vehicleId}
              onSelect={() => onBusSelect(vehicle)}
            />
          ))}
        </svg>
      </div>

      {vehicles.length === 0 ? (
        <p className="mt-3 px-3 text-center text-sm text-zinc-500 sm:px-0 dark:text-zinc-400">
          No live vehicles detected right now.
        </p>
      ) : null}

      <p className="mt-3 px-3 pb-2 text-center text-xs text-zinc-500 sm:px-0 sm:pb-0 dark:text-zinc-400">
        Tap a bus or stop for details. Positions are estimated from live
        predictions.
      </p>
    </section>
  );
}
