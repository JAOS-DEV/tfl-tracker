import { LOOP_EDGE_PADDING } from "@/lib/constants";
import { isPossibleGhostBus } from "@/lib/ghostDisplay";
import type {
  EstimatedVehiclePosition,
  MarkerState,
  NormalizedRoute,
} from "@/lib/tfl/types";

export const TERMINUS_WAIT_SECONDS = 180;
export const TERMINUS_PROGRESS_TOLERANCE = 0.025;

export interface TerminusLayoverResult {
  markerState: MarkerState;
  terminusLayoverLabel?: string;
}

function getLegProgressBounds(
  direction: EstimatedVehiclePosition["direction"],
  legLength: number,
): { min: number; max: number } {
  if (legLength <= 1) {
    return direction === "outbound"
      ? { min: 0.2, max: 0.3 }
      : { min: 0.7, max: 0.8 };
  }

  const span = 0.5 - LOOP_EDGE_PADDING * 2;
  const start =
    direction === "outbound"
      ? LOOP_EDGE_PADDING
      : 0.5 + LOOP_EDGE_PADDING;
  const end = start + span;
  return { min: start, max: end };
}

export function detectTerminusLayover(
  vehicle: EstimatedVehiclePosition,
  route: NormalizedRoute,
): TerminusLayoverResult {
  if (isPossibleGhostBus(vehicle) || !vehicle.matched) {
    return { markerState: "live" };
  }

  const leg =
    vehicle.direction === "outbound" ? route.outbound : route.inbound;
  if (leg.length === 0) {
    return { markerState: "live" };
  }

  const lastIndex = leg.length - 1;
  const atTerminalStop =
    vehicle.stopIndex === 0 || vehicle.stopIndex >= lastIndex;
  const waitingAtStop = vehicle.timeToStation >= TERMINUS_WAIT_SECONDS;
  const { min, max } = getLegProgressBounds(vehicle.direction, leg.length);
  const nearLegEnd = vehicle.progress >= max - TERMINUS_PROGRESS_TOLERANCE;
  const nearLegStart = vehicle.progress <= min + TERMINUS_PROGRESS_TOLERANCE;

  if (waitingAtStop && atTerminalStop && nearLegEnd) {
    return {
      markerState: "terminus-layover",
      terminusLayoverLabel: "At terminus",
    };
  }

  if (waitingAtStop && atTerminalStop && nearLegStart) {
    return {
      markerState: "terminus-layover",
      terminusLayoverLabel: "Waiting to start return journey",
    };
  }

  return { markerState: "live" };
}

export function attachTerminusLayoverState(
  vehicles: EstimatedVehiclePosition[],
  route: NormalizedRoute,
): EstimatedVehiclePosition[] {
  return vehicles.map((vehicle) => {
    if (isPossibleGhostBus(vehicle)) {
      return {
        ...vehicle,
        markerState: "possible-ghost" as const,
      };
    }

    const layover = detectTerminusLayover(vehicle, route);
    return {
      ...vehicle,
      markerState: layover.markerState,
      terminusLayoverLabel: layover.terminusLayoverLabel,
    };
  });
}
