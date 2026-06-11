import {
  LOOP_EDGE_PADDING,
  LOOP_LAYOUT,
  type LoopLayoutConfig,
  VEHICLE_POSITIONING,
} from "@/lib/constants";
import { applyScheduleAdherence } from "@/lib/scheduleAdherence";
import { groupPredictionsByVehicle } from "@/lib/tfl/normalizers";
import type {
  EstimatedVehiclePosition,
  LoopStopNode,
  LoopStopsLayout,
  NormalizedRoute,
  NormalizedStop,
  NormalizedVehiclePrediction,
  RouteDirection,
} from "@/lib/tfl/types";

export function stopProgress(
  direction: RouteDirection,
  index: number,
  total: number,
): number {
  if (total <= 1) {
    return direction === "outbound" ? 0.25 : 0.75;
  }

  const span = 0.5 - LOOP_EDGE_PADDING * 2;
  const ratio = index / (total - 1);

  if (direction === "outbound") {
    return LOOP_EDGE_PADDING + ratio * span;
  }

  return 0.5 + LOOP_EDGE_PADDING + (1 - ratio) * span;
}

export function mapProgressToLoopCoordinates(
  progress: number,
  layout: LoopLayoutConfig = LOOP_LAYOUT,
): {
  x: number;
  y: number;
} {
  const { leftX, rightX, topY, bottomY, orientation } = layout;
  const clamped = Math.max(0, Math.min(1, progress));

  if (orientation === "portrait") {
    if (clamped <= 0.5) {
      const t = clamped / 0.5;
      return {
        x: leftX,
        y: topY + t * (bottomY - topY),
      };
    }

    const t = (clamped - 0.5) / 0.5;
    return {
      x: rightX,
      y: bottomY - t * (bottomY - topY),
    };
  }

  if (clamped <= 0.5) {
    const t = clamped / 0.5;
    return { x: leftX + t * (rightX - leftX), y: topY };
  }

  const t = (clamped - 0.5) / 0.5;
  return { x: rightX - t * (rightX - leftX), y: bottomY };
}

function buildDirectionNodes(
  stops: NormalizedStop[],
  direction: RouteDirection,
  labelEveryNth: number,
  layout: LoopLayoutConfig,
): LoopStopNode[] {
  return stops.map((stop, index) => {
    const isTerminal = index === 0 || index === stops.length - 1;
    const shouldLabel =
      isTerminal ||
      index % labelEveryNth === 0 ||
      stops.length <= 8 ||
      layout.orientation === "portrait";

    return {
      stop,
      direction,
      index,
      progress: stopProgress(direction, index, stops.length),
      isTerminal,
      shouldLabel,
    };
  });
}

export function buildLoopStops(
  route: NormalizedRoute,
  labelEveryNth = 6,
  layout: LoopLayoutConfig = LOOP_LAYOUT,
): LoopStopsLayout {
  const mobileLabelNth =
    layout.orientation === "portrait" ? 2 : labelEveryNth;

  return {
    outbound: buildDirectionNodes(
      route.outbound,
      "outbound",
      mobileLabelNth,
      layout,
    ),
    inbound: buildDirectionNodes(
      route.inbound,
      "inbound",
      mobileLabelNth,
      layout,
    ),
  };
}

export function getDirectionEndpoints(
  route: NormalizedRoute,
  direction: RouteDirection,
): { from: string; to: string } {
  const stops = direction === "outbound" ? route.outbound : route.inbound;

  if (stops.length === 0) {
    return { from: "Start", to: "End" };
  }

  return {
    from: stops[0]?.name ?? "Start",
    to: stops[stops.length - 1]?.name ?? "End",
  };
}

export function getVehicleNextPrediction(
  vehiclePredictions: NormalizedVehiclePrediction[],
): NormalizedVehiclePrediction | null {
  if (vehiclePredictions.length === 0) {
    return null;
  }

  return [...vehiclePredictions].sort(
    (a, b) => a.timeToStation - b.timeToStation,
  )[0];
}

export function findStopIndex(
  stops: NormalizedStop[],
  naptanId: string,
): number {
  return stops.findIndex((stop) => stop.naptanId === naptanId);
}

export function resolveDirectionForStop(
  route: NormalizedRoute,
  naptanId: string,
  predictedDirection: RouteDirection,
): RouteDirection | null {
  const outboundIndex = findStopIndex(route.outbound, naptanId);
  const inboundIndex = findStopIndex(route.inbound, naptanId);

  if (outboundIndex >= 0 && inboundIndex < 0) {
    return "outbound";
  }
  if (inboundIndex >= 0 && outboundIndex < 0) {
    return "inbound";
  }
  if (outboundIndex >= 0 && inboundIndex >= 0) {
    return predictedDirection;
  }
  return null;
}

export function estimateVehiclePositionOnRoute(
  prediction: NormalizedVehiclePrediction,
  route: NormalizedRoute,
): {
  direction: RouteDirection | null;
  stopIndex: number;
  progress: number;
  nextStop: NormalizedStop | null;
  matched: boolean;
} {
  const direction = resolveDirectionForStop(
    route,
    prediction.naptanId,
    prediction.direction,
  );

  if (!direction) {
    return {
      direction: null,
      stopIndex: -1,
      progress: 0,
      nextStop: null,
      matched: false,
    };
  }

  const stops = direction === "outbound" ? route.outbound : route.inbound;
  const stopIndex = findStopIndex(stops, prediction.naptanId);

  if (stopIndex < 0) {
    return {
      direction,
      stopIndex: -1,
      progress: 0,
      nextStop: null,
      matched: false,
    };
  }

  const baseProgress = stopProgress(direction, stopIndex, stops.length);
  const offsetRatio = Math.min(
    VEHICLE_POSITIONING.maxOffsetProgress,
    (prediction.timeToStation / 300) * VEHICLE_POSITIONING.maxOffsetProgress,
  );

  let progress = baseProgress;
  if (prediction.timeToStation > VEHICLE_POSITIONING.nearStopSeconds) {
    progress =
      direction === "outbound"
        ? baseProgress - offsetRatio
        : baseProgress + offsetRatio;
  }

  return {
    direction,
    stopIndex,
    progress: Math.max(0.02, Math.min(0.98, progress)),
    nextStop: stops[stopIndex] ?? null,
    matched: true,
  };
}

export function buildVehiclePositions(
  predictions: NormalizedVehiclePrediction[],
  route: NormalizedRoute,
  layout: LoopLayoutConfig = LOOP_LAYOUT,
): EstimatedVehiclePosition[] {
  const grouped = groupPredictionsByVehicle(predictions);
  const positions: EstimatedVehiclePosition[] = [];

  for (const [vehicleId, vehiclePredictions] of grouped.entries()) {
    const nextPrediction = getVehicleNextPrediction(vehiclePredictions);
    if (!nextPrediction) {
      continue;
    }

    const estimate = estimateVehiclePositionOnRoute(nextPrediction, route);
    const coordinates = mapProgressToLoopCoordinates(estimate.progress, layout);

    positions.push({
      vehicleId,
      routeNumber: nextPrediction.routeNumber,
      direction: estimate.direction ?? nextPrediction.direction,
      destinationName: nextPrediction.destinationName,
      currentLocation: nextPrediction.currentLocation,
      expectedArrival: nextPrediction.expectedArrival,
      timeToStation: nextPrediction.timeToStation,
      nextPrediction,
      nextStop: estimate.nextStop,
      stopIndex: estimate.stopIndex,
      progress: estimate.progress,
      x: coordinates.x,
      y: coordinates.y,
      matched: estimate.matched,
      adherence: "onTime",
    });
  }

  const sorted = spreadOverlappingMarkers(
    positions.sort((a, b) => a.progress - b.progress),
    layout,
  );
  return applyScheduleAdherence(sorted);
}

function spreadOverlappingMarkers(
  positions: EstimatedVehiclePosition[],
  layout: LoopLayoutConfig,
): EstimatedVehiclePosition[] {
  const groups = new Map<string, EstimatedVehiclePosition[]>();

  for (const position of positions) {
    const key = `${position.direction}-${position.stopIndex}-${Math.round(position.progress * 100)}`;
    const group = groups.get(key) ?? [];
    group.push(position);
    groups.set(key, group);
  }

  return positions.map((position) => {
    const key = `${position.direction}-${position.stopIndex}-${Math.round(position.progress * 100)}`;
    const group = groups.get(key) ?? [position];
    const index = group.findIndex(
      (candidate) => candidate.vehicleId === position.vehicleId,
    );

    if (group.length <= 1 || index < 0) {
      return position;
    }

    const offset = index * 16;
    if (layout.orientation === "portrait") {
      const xOffset = offset * (position.direction === "outbound" ? -1 : 1);
      return { ...position, x: position.x + xOffset };
    }

    const yOffset = offset * (position.direction === "outbound" ? -1 : 1);
    return { ...position, y: position.y + yOffset };
  });
}


export interface LoopLegEndpoints {
  outboundStart: { x: number; y: number };
  outboundEnd: { x: number; y: number };
  inboundStart: { x: number; y: number };
  inboundEnd: { x: number; y: number };
}

export function getLoopLegEndpoints(
  route: NormalizedRoute,
  layout: LoopLayoutConfig,
): LoopLegEndpoints {
  const outboundCount = Math.max(route.outbound.length, 1);
  const inboundCount = Math.max(route.inbound.length, 1);

  return {
    outboundStart: mapProgressToLoopCoordinates(
      stopProgress("outbound", 0, outboundCount),
      layout,
    ),
    outboundEnd: mapProgressToLoopCoordinates(
      stopProgress(
        "outbound",
        Math.max(route.outbound.length - 1, 0),
        outboundCount,
      ),
      layout,
    ),
    inboundStart: mapProgressToLoopCoordinates(
      stopProgress("inbound", 0, inboundCount),
      layout,
    ),
    inboundEnd: mapProgressToLoopCoordinates(
      stopProgress(
        "inbound",
        Math.max(route.inbound.length - 1, 0),
        inboundCount,
      ),
      layout,
    ),
  };
}

export function buildLoopPath(
  route: NormalizedRoute,
  layout: LoopLayoutConfig,
): string {
  const {
    outboundStart,
    outboundEnd,
    inboundStart,
    inboundEnd,
  } = getLoopLegEndpoints(route, layout);

  return `M ${outboundStart.x} ${outboundStart.y} L ${outboundEnd.x} ${outboundEnd.y} L ${inboundEnd.x} ${inboundEnd.y} L ${inboundStart.x} ${inboundStart.y} Z`;
}

export function getDirectionLabel(
  route: NormalizedRoute,
  direction: RouteDirection,
): string {
  const stops = direction === "outbound" ? route.outbound : route.inbound;
  if (stops.length === 0) {
    return direction === "outbound" ? "Outbound" : "Inbound";
  }

  const terminus = stops[stops.length - 1]?.name;
  return `Towards ${terminus}`;
}
