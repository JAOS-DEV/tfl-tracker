"use client";

import dynamic from "next/dynamic";
import { memo, useMemo, useState } from "react";
import { DirectionSegmentedControl } from "@/components/DirectionSegmentedControl";
import type { LoopMarkerLabelSettings } from "@/components/LoopMarkerInfoBadges";
import {
  buildRouteMapVehicleMarkers,
  hasRouteMapGeometry,
  ROUTE_MAP_UNAVAILABLE_MESSAGE,
} from "@/lib/routeMapGeometry";
import { buildBusAriaLabel } from "@/lib/routeMapPopups";
import type {
  EstimatedVehiclePosition,
  NormalizedRoute,
  NormalizedStop,
  RouteDirection,
} from "@/lib/tfl/types";

const RouteMapModal = dynamic(
  () => import("@/components/RouteMapModal").then((mod) => mod.RouteMapModal),
  { ssr: false },
);

const RouteLeafletMap = dynamic(
  () => import("@/components/RouteLeafletMap").then((mod) => mod.RouteLeafletMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-48 min-h-[180px] items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
        Loading map preview…
      </div>
    ),
  },
);

interface RouteMapPanelProps {
  route: NormalizedRoute;
  direction: RouteDirection;
  onDirectionChange: (direction: RouteDirection) => void;
  vehicles: EstimatedVehiclePosition[];
  selectedVehicleId: string | null;
  loopLabelSettings: LoopMarkerLabelSettings;
  onVehicleSelect: (vehicle: EstimatedVehiclePosition) => void;
  onStopSelect?: (stop: NormalizedStop) => void;
  isMobile: boolean;
}

export const RouteMapPanel = memo(function RouteMapPanel({
  route,
  direction,
  onDirectionChange,
  vehicles,
  selectedVehicleId,
  loopLabelSettings,
  onVehicleSelect,
  onStopSelect,
  isMobile,
}: RouteMapPanelProps): React.ReactElement {
  const [mapExpanded, setMapExpanded] = useState(false);
  const mapAvailable = hasRouteMapGeometry(route, direction);
  const vehicleMarkers = useMemo(
    () => buildRouteMapVehicleMarkers(vehicles, route, direction),
    [vehicles, route, direction],
  );

  const handleStopSelect = (stop: NormalizedStop): void => {
    onStopSelect?.(stop);
  };

  return (
    <div className="space-y-4 px-4">
      <DirectionSegmentedControl
        route={route}
        selectedDirection={direction}
        onChange={onDirectionChange}
        variant={isMobile ? "mobile" : "desktop"}
      />

      {mapAvailable ? (
        <div className="space-y-3">
          <div className="relative">
            <RouteLeafletMap
              route={route}
              direction={direction}
              vehicles={vehicles}
              selectedVehicleId={selectedVehicleId}
              loopLabelSettings={loopLabelSettings}
              onVehicleSelect={onVehicleSelect}
              variant="preview"
              ariaLabel={`Map preview for route ${route.routeId}, ${direction} direction`}
              className="h-48 border border-zinc-200 dark:border-zinc-800"
            />
            {!mapExpanded ? (
              <button
                type="button"
                onClick={() => setMapExpanded(true)}
                aria-label={`Open larger map for route ${route.routeId}`}
                className="absolute inset-x-0 top-0 bottom-6 z-[500] cursor-zoom-in rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
              />
            ) : null}
          </div>

          {vehicleMarkers.length > 0 ? (
            <details className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
              <summary className="cursor-pointer text-sm font-medium text-zinc-700 dark:text-zinc-200">
                Bus list ({vehicleMarkers.length})
              </summary>
              <ul className="mt-2 space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
                {vehicleMarkers.map(({ vehicle }) => (
                  <li key={`summary-${vehicle.vehicleId}`}>
                    <button
                      type="button"
                      className="min-h-11 w-full rounded-lg px-2 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      onClick={() => {
                        onVehicleSelect(vehicle);
                        setMapExpanded(true);
                      }}
                    >
                      {buildBusAriaLabel(vehicle)}
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
          {ROUTE_MAP_UNAVAILABLE_MESSAGE}
        </div>
      )}

      {mapExpanded && mapAvailable ? (
        <RouteMapModal
          route={route}
          direction={direction}
          vehicles={vehicles}
          selectedVehicleId={selectedVehicleId}
          loopLabelSettings={loopLabelSettings}
          onVehicleSelect={onVehicleSelect}
          onDirectionChange={onDirectionChange}
          onStopSelect={onStopSelect ? handleStopSelect : undefined}
          onClose={() => setMapExpanded(false)}
          isMobile={isMobile}
        />
      ) : null}

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Geographic map view uses stop coordinates from the route sequence. For a
        fully accessible stop-by-stop view, use the List tab. Production or heavy
        usage may need a dedicated map tile provider.
      </p>
    </div>
  );
});
