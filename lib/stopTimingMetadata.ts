import type { NormalizedRoute, NormalizedStop } from "@/lib/tfl/types";

export type TimingPointSource =
  | "ibus-timing-point"
  | "qsi-import"
  | "manual-static";

export interface StopTimingMetadata {
  isTimingPoint: boolean;
  isQsiPoint: boolean;
  timingPointSource?: TimingPointSource;
}

function normalizeStopTimingMetadata(stop: NormalizedStop): NormalizedStop {
  const source = stop.timingPointSource;
  const hasVerifiedTimingPoint =
    source === "ibus-timing-point" || source === "manual-static";
  const hasVerifiedQsi = source === "qsi-import" && stop.isQsiPoint === true;

  return {
    ...stop,
    isTimingPoint: hasVerifiedTimingPoint && stop.isTimingPoint === true,
    isQsiPoint: hasVerifiedQsi,
    timingPointSource: source,
  };
}

export function enrichRouteTimingMetadata(route: NormalizedRoute): NormalizedRoute {
  return {
    ...route,
    outbound: route.outbound.map(normalizeStopTimingMetadata),
    inbound: route.inbound.map(normalizeStopTimingMetadata),
  };
}

export function hasAnyTimingPointMetadata(route: NormalizedRoute): boolean {
  return [...route.outbound, ...route.inbound].some(
    (stop) => stop.isTimingPoint || stop.isQsiPoint,
  );
}
