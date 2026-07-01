"use client";

import dynamic from "next/dynamic";
import { memo, useCallback, useEffect, useId, useState } from "react";
import { DirectionSegmentedControl } from "@/components/DirectionSegmentedControl";
import type { LoopMarkerLabelSettings } from "@/components/LoopMarkerInfoBadges";
import type {
  EstimatedVehiclePosition,
  NormalizedRoute,
  NormalizedStop,
  RouteDirection,
} from "@/lib/tfl/types";

const RouteLeafletMap = dynamic(
  () => import("@/components/RouteLeafletMap").then((mod) => mod.RouteLeafletMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
        Loading map…
      </div>
    ),
  },
);

interface RouteMapModalProps {
  route: NormalizedRoute;
  direction: RouteDirection;
  vehicles: EstimatedVehiclePosition[];
  selectedVehicleId: string | null;
  loopLabelSettings: LoopMarkerLabelSettings;
  onVehicleSelect: (vehicle: EstimatedVehiclePosition) => void;
  onDirectionChange: (direction: RouteDirection) => void;
  onStopSelect?: (stop: NormalizedStop) => void;
  onClose: () => void;
  isMobile: boolean;
}

export const RouteMapModal = memo(function RouteMapModal({
  route,
  direction,
  vehicles,
  selectedVehicleId,
  loopLabelSettings,
  onVehicleSelect,
  onDirectionChange,
  onStopSelect,
  onClose,
  isMobile,
}: RouteMapModalProps): React.ReactElement {
  const titleId = useId();
  const [fitBoundsSignal, setFitBoundsSignal] = useState(0);

  const handleFitRoute = useCallback(() => {
    setFitBoundsSignal((value) => value + 1);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Dismiss route map backdrop"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative flex w-full flex-col overflow-hidden border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900 ${
          isMobile
            ? "h-[92dvh] max-h-[92dvh] rounded-t-3xl pt-[max(env(safe-area-inset-top),0px)]"
            : "h-[min(82vh,900px)] w-[min(88vw,1200px)] rounded-2xl"
        }`}
      >
        {isMobile ? (
          <div className="flex shrink-0 items-center justify-center pt-2">
            <span className="h-1.5 w-12 rounded-full bg-zinc-300 dark:bg-zinc-600" />
          </div>
        ) : null}

        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2
            id={titleId}
            className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
          >
            Route {route.routeId} map
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleFitRoute}
              className="min-h-11 rounded-xl border border-zinc-200 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Fit route
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close route map"
              className="min-h-11 min-w-11 rounded-xl px-3 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Close
            </button>
          </div>
        </div>

        <div className="shrink-0 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
          <DirectionSegmentedControl
            route={route}
            selectedDirection={direction}
            onChange={onDirectionChange}
            variant={isMobile ? "mobile" : "desktop"}
          />
        </div>

        <div className="min-h-0 flex-1 p-3 pb-[max(env(safe-area-inset-bottom),12px)]">
          <RouteLeafletMap
            route={route}
            direction={direction}
            vehicles={vehicles}
            selectedVehicleId={selectedVehicleId}
            loopLabelSettings={loopLabelSettings}
            onVehicleSelect={onVehicleSelect}
            onStopSelect={onStopSelect}
            fitBoundsSignal={fitBoundsSignal}
            ariaLabel={`Interactive map for route ${route.routeId}, ${direction} direction`}
            className="border border-zinc-200 dark:border-zinc-800"
          />
        </div>
      </div>
    </div>
  );
});

export default RouteMapModal;
