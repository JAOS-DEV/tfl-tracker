import { LOOP_EDGE_PADDING } from "@/lib/constants";
import type { LoopLayoutConfig } from "@/lib/constants";
import { isPossibleGhostBus } from "@/lib/ghostDisplay";
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

    const layover = detectTerminusLayover(vehicle, route);
    const withState = {
      ...vehicle,
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
