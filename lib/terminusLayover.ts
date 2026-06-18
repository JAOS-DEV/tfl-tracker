import { LOOP_EDGE_PADDING } from "@/lib/constants";
import type { LoopLayoutConfig } from "@/lib/constants";
import { isPossibleGhostBus } from "@/lib/ghostDisplay";
import {
  clampVehicleProgressOnRoute,
  getDirectionLegProgressBounds,
  mapProgressToLoopCoordinates,
} from "@/lib/routePositioning";
import type {
  EstimatedVehiclePosition,
  MarkerState,
  NormalizedRoute,
} from "@/lib/tfl/types";

export type TerminusLayoverKind = "leg-start" | "leg-end";

export const TERMINUS_WAIT_SECONDS = 180;
export const TERMINUS_PROGRESS_TOLERANCE = 0.025;

export const TERMINUS_LAYOVER_OUTBOUND_PROGRESS = 0.25;
export const TERMINUS_LAYOVER_INBOUND_PROGRESS = 0.75;

export interface TerminusLayoverDisplayPosition {
  x: number;
  y: number;
  progress: number;
}

export function getTerminusLayoverDisplayPosition(
  direction: EstimatedVehiclePosition["direction"],
  layout: LoopLayoutConfig,
  layoverKind: TerminusLayoverKind,
): TerminusLayoverDisplayPosition {
  const { leftX, rightX, topY, bottomY } = layout;
  const midX = (leftX + rightX) / 2;
  const midY = (topY + bottomY) / 2;
  const xInset = (rightX - leftX) * LOOP_EDGE_PADDING * 2;
  const yInset = (bottomY - topY) * LOOP_EDGE_PADDING * 2;

  if (layout.orientation === "portrait") {
    const topConnectorY = topY + yInset;
    const bottomConnectorY = bottomY - yInset;
    const useTopConnector =
      (direction === "outbound" && layoverKind === "leg-start") ||
      (direction === "inbound" && layoverKind === "leg-end");

    if (useTopConnector) {
      return {
        x: midX,
        y: topConnectorY,
        progress: TERMINUS_LAYOVER_OUTBOUND_PROGRESS,
      };
    }

    return {
      x: midX,
      y: bottomConnectorY,
      progress: TERMINUS_LAYOVER_INBOUND_PROGRESS,
    };
  }

  const leftConnectorX = leftX + xInset;
  const rightConnectorX = rightX - xInset;
  const useRightConnector =
    (direction === "outbound" && layoverKind === "leg-end") ||
    (direction === "inbound" && layoverKind === "leg-start");

  if (useRightConnector) {
    return {
      x: rightConnectorX,
      y: midY,
      progress: TERMINUS_LAYOVER_OUTBOUND_PROGRESS,
    };
  }

  return {
    x: leftConnectorX,
    y: midY,
    progress: TERMINUS_LAYOVER_INBOUND_PROGRESS,
  };
}

export interface TerminusLayoverResult {
  markerState: MarkerState;
  terminusLayoverLabel?: string;
  terminusLayoverKind?: TerminusLayoverKind;
}

function getLegProgressBounds(
  direction: EstimatedVehiclePosition["direction"],
  legLength: number,
): { min: number; max: number } {
  return getDirectionLegProgressBounds(direction, legLength);
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
  const nearLegStart = vehicle.progress <= min + TERMINUS_PROGRESS_TOLERANCE;
  const beyondLegEnd = vehicle.progress > max + TERMINUS_PROGRESS_TOLERANCE;
  const atOrBeyondFinalStop =
    vehicle.stopIndex >= lastIndex &&
    (waitingAtStop || beyondLegEnd || vehicle.timeToStation <= 30);

  if (atOrBeyondFinalStop && (waitingAtStop || beyondLegEnd)) {
    return {
      markerState: "terminus-layover",
      terminusLayoverLabel: "At terminus",
      terminusLayoverKind: "leg-end",
    };
  }

  if (waitingAtStop && atTerminalStop && nearLegStart) {
    return {
      markerState: "terminus-layover",
      terminusLayoverLabel: "Waiting to start return journey",
      terminusLayoverKind: "leg-start",
    };
  }

  return { markerState: "live" };
}

export function attachTerminusLayoverState(
  vehicles: EstimatedVehiclePosition[],
  route: NormalizedRoute,
  layout: LoopLayoutConfig,
): EstimatedVehiclePosition[] {
  return vehicles.map((vehicle) => {
    if (isPossibleGhostBus(vehicle)) {
      return {
        ...vehicle,
        markerState: "possible-ghost" as const,
      };
    }

    const clampedProgress = vehicle.matched
      ? clampVehicleProgressOnRoute(vehicle.progress, vehicle.direction, route)
      : vehicle.progress;
    const clampedCoordinates =
      vehicle.matched && clampedProgress !== vehicle.progress
        ? mapProgressToLoopCoordinates(clampedProgress, layout)
        : { x: vehicle.x, y: vehicle.y };

    const normalizedVehicle =
      clampedProgress === vehicle.progress &&
      clampedCoordinates.x === vehicle.x &&
      clampedCoordinates.y === vehicle.y
        ? vehicle
        : {
            ...vehicle,
            progress: clampedProgress,
            x: clampedCoordinates.x,
            y: clampedCoordinates.y,
          };

    const layover = detectTerminusLayover(normalizedVehicle, route);
    const withState = {
      ...normalizedVehicle,
      markerState: layover.markerState,
      terminusLayoverLabel: layover.terminusLayoverLabel,
      terminusLayoverKind: layover.terminusLayoverKind,
    };

    if (layover.markerState !== "terminus-layover" || !layover.terminusLayoverKind) {
      return withState;
    }

    const displayPosition = getTerminusLayoverDisplayPosition(
      vehicle.direction,
      layout,
      layover.terminusLayoverKind,
    );

    return {
      ...withState,
      x: displayPosition.x,
      y: displayPosition.y,
      progress: displayPosition.progress,
    };
  });
}
