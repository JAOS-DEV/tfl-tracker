import { GHOST_MARKER_RING_CLASS, isPossibleGhostBus } from "@/lib/ghostDisplay";
import type { EstimatedVehiclePosition } from "@/lib/tfl/types";

const adherenceRingClasses = {
  onTime:
    "fill-emerald-500/25 stroke-emerald-500 dark:fill-emerald-400/30 dark:stroke-emerald-400",
  late: "fill-red-500/25 stroke-red-500 dark:fill-red-400/30 dark:stroke-red-400",
  early:
    "fill-amber-400/30 stroke-amber-500 dark:fill-amber-300/30 dark:stroke-amber-300",
  unknown:
    "fill-sky-500/20 stroke-sky-500 dark:fill-sky-400/20 dark:stroke-sky-400",
} as const;

const terminusRingClass =
  "fill-zinc-400/20 stroke-zinc-500 stroke-dashed dark:fill-zinc-500/20 dark:stroke-zinc-400";

export function getRouteMapMarkerRingClass(
  vehicle: EstimatedVehiclePosition,
): string {
  if (isPossibleGhostBus(vehicle)) {
    return GHOST_MARKER_RING_CLASS;
  }

  if (vehicle.markerState === "terminus-layover") {
    return terminusRingClass;
  }

  return adherenceRingClasses[vehicle.adherence];
}

export function isRouteMapMarkerFaded(
  vehicle: EstimatedVehiclePosition,
): boolean {
  return (
    !isPossibleGhostBus(vehicle) &&
    vehicle.markerState !== "terminus-layover" &&
    (vehicle.ghostStatus === "missingLatest" ||
      vehicle.ghostStatus === "disappeared")
  );
}
