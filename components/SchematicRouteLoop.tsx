"use client";

import { memo, useMemo } from "react";
import { GhostComparisonDiagnostics } from "@/components/GhostComparisonDiagnostics";
import { VehicleRegistrationDiagnostics } from "@/components/VehicleRegistrationDiagnostics";
import { LoopIntelligenceOverlay } from "@/components/LoopIntelligenceOverlay";
import type { LoopMarkerLabelSettings } from "@/components/LoopMarkerInfoBadges";
import { RouteLoopBusMarker } from "@/components/RouteLoopBusMarker";
import { RouteLoopDirectionChevrons } from "@/components/RouteLoopDirectionChevrons";
import { RouteLoopDirectionGuide } from "@/components/RouteLoopDirectionGuide";
import { RouteLoopStopNode } from "@/components/RouteLoopStopNode";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { DisplayMarkerPosition } from "@/hooks/useSmoothBusMarkers";
import type { SmoothMovementDecision } from "@/lib/smoothBusMovement";
import type { LoopLayoutConfig } from "@/lib/constants";
import { getLoopLayout } from "@/lib/constants";
import { getRouteBadgeCenter } from "@/lib/loopMarkerLayout";
import {
  buildLoopPath,
  buildLoopStops,
  getLoopLegEndpoints,
  mapProgressToLoopCoordinates,
} from "@/lib/routePositioning";
import {
  detectBunchingClusters,
} from "@/lib/serviceIntelligence";
import type {
  EstimatedVehiclePosition,
  GhostComparisonSummary,
  GhostRunDiagnostics,
  LoopStopNode,
  NormalizedRoute,
  NormalizedStop,
  StopDisruption,
  VehicleRegistrationDiagnostic,
} from "@/lib/tfl/types";

interface SchematicRouteLoopProps {
  route: NormalizedRoute;
  vehicles: EstimatedVehiclePosition[];
  displayPositions: Record<string, DisplayMarkerPosition>;
  movementDecisions?: Record<string, SmoothMovementDecision>;
  showAdvancedDiagnostics?: boolean;
  loopLabelSettings?: LoopMarkerLabelSettings;
  stopDisruptionsByNaptanId?: Map<string, StopDisruption>;
  scheduleGhostDiagnostics?: string[];
  ghostComparisonSummary?: GhostComparisonSummary;
  ghostRunDiagnostics?: GhostRunDiagnostics[];
  registrationDiagnostics?: VehicleRegistrationDiagnostic[];
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

export const SchematicRouteLoop = memo(function SchematicRouteLoop({
  route,
  vehicles,
  displayPositions,
  movementDecisions,
  showAdvancedDiagnostics = false,
  loopLabelSettings,
  scheduleGhostDiagnostics,
  ghostComparisonSummary,
  ghostRunDiagnostics,
  registrationDiagnostics,
  stopDisruptionsByNaptanId,
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
  const bunchingClusters = useMemo(
    () => detectBunchingClusters(vehicles),
    [vehicles],
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

  const { viewBoxWidth, viewBoxHeight } = layout;
  const loopPath = useMemo(
    () => buildLoopPath(route, layout),
    [route, layout],
  );
  const legEndpoints = useMemo(
    () => getLoopLegEndpoints(route, layout),
    [route, layout],
  );
  const allNodes: LoopStopNode[] = useMemo(
    () => [...loopStops.outbound, ...loopStops.inbound],
    [loopStops],
  );
  if (route.outbound.length === 0 && route.inbound.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
        No stops available to draw the route loop.
      </div>
    );
  }

  const routeBadge = getRouteBadgeCenter(layout, isMobile);
  const routeBadgeWidth = isMobile ? 88 : 72;
  const routeBadgeHeight = isMobile ? 48 : 40;
  const routeBadgeFontSize = isMobile ? 24 : 20;

  return (
    <section className="w-full min-w-0 overflow-x-hidden sm:rounded-2xl sm:border sm:border-zinc-200 sm:bg-zinc-50 sm:p-4 dark:sm:border-zinc-800 dark:sm:bg-zinc-950">
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

      <div className="mb-2 space-y-2 px-3 text-sm text-zinc-700 sm:px-0 dark:text-zinc-300">
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-emerald-500" />
            Bus on time
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-amber-400" />
            Bus early
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-500" />
            Bus late
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-full border-2 border-dashed border-zinc-500 bg-zinc-400/20 dark:border-zinc-400 dark:bg-zinc-500/20" />
            At terminus / waiting
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-full border-2 border-dashed border-violet-400 bg-violet-400/15 dark:border-violet-300 dark:bg-violet-500/15" />
            Possible ghost
          </span>
        </div>
        {showAdvancedDiagnostics ? (
          <>
            <GhostComparisonDiagnostics
              summary={ghostComparisonSummary}
              runDiagnostics={ghostRunDiagnostics}
              legacyDiagnostics={scheduleGhostDiagnostics}
            />
            <VehicleRegistrationDiagnostics
              diagnostics={registrationDiagnostics}
            />
          </>
        ) : null}
      </div>

      <div className="mb-3 min-w-0">
        <RouteLoopDirectionGuide
          route={route}
          orientation={layout.orientation}
        />
      </div>

      <div className="loop-diagram-surface w-full px-1 sm:px-0">
        <svg
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          preserveAspectRatio="xMidYMid meet"
          className="loop-diagram-svg mx-auto block h-auto w-full"
          role="img"
          aria-label={`Schematic loop diagram for route ${route.routeId}`}
        >
          <path
            d={loopPath}
            fill="none"
            stroke="#0EA5E9"
            strokeWidth={isMobile ? 7 : 5}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.95}
          />

          <LoopIntelligenceOverlay
            bunchingClusters={bunchingClusters}
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
            legStart={legEndpoints.inboundStart}
            legEnd={legEndpoints.inboundEnd}
          />

          <polygon
            points={terminalArrow(layout, "outbound", legEndpoints)}
            className="fill-sky-600 dark:fill-sky-300"
          />
          <polygon
            points={terminalArrow(layout, "inbound", legEndpoints)}
            className="fill-violet-600 dark:fill-violet-400"
          />

          {allNodes.map((node) => {
            const { x, y } = mapProgressToLoopCoordinates(node.progress, layout);
            const stopDisruption = stopDisruptionsByNaptanId?.get(
              node.stop.naptanId,
            );
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
                isClosed={Boolean(stopDisruption)}
                stopDisruption={stopDisruption}
                onSelect={() => onStopSelect(node.stop)}
              />
            );
          })}

          <g aria-hidden="true">
            <rect
              x={routeBadge.x - routeBadgeWidth / 2}
              y={routeBadge.y - routeBadgeHeight / 2}
              width={routeBadgeWidth}
              height={routeBadgeHeight}
              rx={12}
              fill="#0284C7"
              stroke="#0EA5E9"
              strokeWidth={2}
            />
            <text
              x={routeBadge.x}
              y={routeBadge.y + routeBadgeFontSize / 3}
              textAnchor="middle"
              fontSize={routeBadgeFontSize}
              fontWeight={700}
              fill="#FFFFFF"
              fontFamily="Arial, sans-serif"
            >
              {route.routeId}
            </text>
          </g>

          {vehicles.map((vehicle) => {
            const display = displayPositions[vehicle.vehicleId];
            const movementDecision = movementDecisions?.[vehicle.vehicleId];
            return (
              <RouteLoopBusMarker
                key={vehicle.vehicleId}
                vehicle={vehicle}
                displayX={display?.x ?? vehicle.x}
                displayY={display?.y ?? vehicle.y}
                movementDecision={
                  showAdvancedDiagnostics ? movementDecision : undefined
                }
                loopLabelSettings={loopLabelSettings}
                layout={layout}
                markerSize={markerSize}
                isSelected={selectedVehicleId === vehicle.vehicleId}
                onSelect={() => onBusSelect(vehicle)}
              />
            );
          })}
        </svg>
      </div>

      {vehicles.length === 0 ? (
        <p className="mt-3 px-3 text-center text-sm text-zinc-500 sm:px-0 dark:text-zinc-400">
          No live vehicles detected right now.
        </p>
      ) : null}

      <p className="mt-3 px-3 pb-2 text-center text-xs text-zinc-500 sm:px-0 sm:pb-0 dark:text-zinc-400">
        Tap a bus or stop for details. Positions are estimated from live
        predictions. Yellow stop dots mark where a live bus is heading next.
        {stopDisruptionsByNaptanId && stopDisruptionsByNaptanId.size > 0
          ? " Red × marks a stop that TfL reports as closed."
          : ""}
      </p>
    </section>
  );
});
