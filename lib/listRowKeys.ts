import type { RouteDirection } from "@/lib/tfl/types";

export function buildStopRowKey(
  routeId: string,
  direction: RouteDirection,
  stopId: string,
  stopIndex: number,
): string {
  return `${routeId}:${direction}:${stopId}:${stopIndex}`;
}

export function buildStopRowDomId(rowKey: string): string {
  return `stop-row-${rowKey.replace(/:/g, "-")}`;
}

export function buildStopBusChipKey(
  rowKey: string,
  vehicleId: string,
  vehicleIndex: number,
): string {
  return `${rowKey}:bus:${vehicleId}:${vehicleIndex}`;
}

export function buildStopPredictionKey(
  rowKey: string,
  predictionId: string,
  predictionIndex: number,
): string {
  return `${rowKey}:prediction:${predictionId}:${predictionIndex}`;
}

export function buildStopDisruptionKey(
  rowKey: string,
  disruptionId: string,
): string {
  return `${rowKey}:disruption:${disruptionId}`;
}

export function hasUniqueKeys(keys: string[]): boolean {
  return new Set(keys).size === keys.length;
}

export function buildDirectionStopRowKeys(
  routeId: string,
  direction: RouteDirection,
  stops: Array<{ id: string }>,
): string[] {
  return stops.map((stop, stopIndex) =>
    buildStopRowKey(routeId, direction, stop.id, stopIndex),
  );
}
