"use client";

import { memo, useMemo, useState } from "react";
import {
  getGhostMarkerIconText,
  isPossibleGhostBus,
} from "@/lib/ghostDisplay";
import {
  buildRouteMapPolyline,
  buildRouteMapVehicleMarkers,
  computeRouteMapViewport,
  getGeographicStops,
  projectGeoToSvg,
  type GeographicStop,
} from "@/lib/routeMapGeometry";
import {
  getRouteMapMarkerRingClass,
  isRouteMapMarkerFaded,
} from "@/lib/routeMapMarkerStyles";
import { buildBusAriaLabel } from "@/lib/routeMapPopups";
import type {
  EstimatedVehiclePosition,
  NormalizedRoute,
  RouteDirection,
} from "@/lib/tfl/types";

const MAP_WIDTH = 640;
const MAP_HEIGHT = 360;
const PREVIEW_HEIGHT_CLASS = "h-48 min-h-[180px]";
const FULL_HEIGHT_CLASS = "h-[min(40vh,420px)] min-h-[320px]";

interface RouteMapViewProps {
  route: NormalizedRoute;
  direction: RouteDirection;
  vehicles: EstimatedVehiclePosition[];
  selectedVehicleId: string | null;
  onVehicleSelect: (vehicle: EstimatedVehiclePosition) => void;
  variant?: "preview" | "full";
}

export const RouteMapView = memo(function RouteMapView({
  route,
  direction,
  vehicles,
  selectedVehicleId,
  onVehicleSelect,
  variant = "full",
}: RouteMapViewProps): React.ReactElement {
  const [focusedVehicleId, setFocusedVehicleId] = useState<string | null>(null);
  const isPreview = variant === "preview";
  const geographicStops = useMemo(
    () => getGeographicStops(route, direction),
    [route, direction],
  );
  const vehicleMarkers = useMemo(
    () => buildRouteMapVehicleMarkers(vehicles, route, direction),
    [vehicles, route, direction],
  );
  const viewport = useMemo(() => {
    const points = [
      ...geographicStops,
      ...vehicleMarkers.map((marker) => marker.point),
    ];
    return computeRouteMapViewport(points);
  }, [geographicStops, vehicleMarkers]);

  const polyline = useMemo(() => {
    if (!viewport) {
      return "";
    }

    return buildRouteMapPolyline(
      geographicStops,
      viewport,
      MAP_WIDTH,
      MAP_HEIGHT,
    );
  }, [geographicStops, viewport]);

  if (!viewport) {
    return (
      <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
        Map unavailable for this route right now
      </div>
    );
  }

  return (
    <div className={isPreview ? "space-y-0" : "space-y-3"}>
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950">
        <svg
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          role="img"
          aria-label={`Geographic map preview for route ${route.routeId}, ${direction} direction`}
          className={`w-full touch-pan-y ${isPreview ? PREVIEW_HEIGHT_CLASS : FULL_HEIGHT_CLASS}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <rect
            x={0}
            y={0}
            width={MAP_WIDTH}
            height={MAP_HEIGHT}
            className="fill-zinc-100 dark:fill-zinc-900"
          />
          <polyline
            points={polyline}
            fill="none"
            className="stroke-sky-600 stroke-[3] dark:stroke-sky-400"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {geographicStops.map((stop: GeographicStop, index) => {
            const point = projectGeoToSvg(stop, viewport, MAP_WIDTH, MAP_HEIGHT);
            const isTerminal =
              index === 0 || index === geographicStops.length - 1;

            return (
              <g key={stop.naptanId}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={isTerminal ? 5 : 3.5}
                  className={
                    isTerminal
                      ? "fill-zinc-900 stroke-white dark:fill-zinc-100 dark:stroke-zinc-900"
                      : "fill-white stroke-zinc-500 dark:fill-zinc-800 dark:stroke-zinc-300"
                  }
                  strokeWidth={1.5}
                />
                {isTerminal ? <title>{stop.name}</title> : null}
              </g>
            );
          })}
          {vehicleMarkers.map(({ vehicle, point }) => {
            const projected = projectGeoToSvg(
              point,
              viewport,
              MAP_WIDTH,
              MAP_HEIGHT,
            );
            const isSelected = selectedVehicleId === vehicle.vehicleId;
            const isFocused = focusedVehicleId === vehicle.vehicleId;
            const markerLabel = buildBusAriaLabel(vehicle);
            const iconText = isPossibleGhostBus(vehicle)
              ? getGhostMarkerIconText(vehicle)
              : vehicle.routeNumber;

            return (
              <g
                key={vehicle.vehicleId}
                transform={`translate(${projected.x}, ${projected.y})`}
                opacity={isRouteMapMarkerFaded(vehicle) ? 0.65 : 1}
                role="button"
                tabIndex={isPreview ? -1 : 0}
                aria-label={markerLabel}
                aria-hidden={isPreview ? true : undefined}
                className={isPreview ? undefined : "cursor-pointer"}
                onClick={
                  isPreview
                    ? undefined
                    : () => {
                        setFocusedVehicleId(vehicle.vehicleId);
                        onVehicleSelect(vehicle);
                      }
                }
                onKeyDown={
                  isPreview
                    ? undefined
                    : (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setFocusedVehicleId(vehicle.vehicleId);
                          onVehicleSelect(vehicle);
                        }
                      }
                }
              >
                <circle
                  r={16}
                  className={`stroke-2 ${getRouteMapMarkerRingClass(vehicle)} ${
                    isSelected || isFocused ? "animate-pulse" : ""
                  }`}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={10}
                  fontWeight={700}
                  className="fill-zinc-900 dark:fill-zinc-100"
                  pointerEvents="none"
                >
                  {iconText}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
});
