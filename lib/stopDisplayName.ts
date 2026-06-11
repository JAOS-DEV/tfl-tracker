import type {
  NormalizedRoute,
  NormalizedStop,
  RouteDirection,
  ScheduledStopTime,
} from "@/lib/tfl/types";

function looksLikeStopId(value: string): boolean {
  return /^[0-9]{6,}[A-Z]?$/i.test(value.trim());
}

export function resolveStopDisplayName(
  stopId: string,
  route: NormalizedRoute,
  direction: RouteDirection,
): string | null {
  const stops = direction === "outbound" ? route.outbound : route.inbound;
  const stop = stops.find(
    (item) => item.naptanId === stopId || item.id === stopId,
  );
  return stop?.name ?? null;
}

export function formatMatchedStopDisplayName(
  vehicle: {
    nextStop: NormalizedStop | null;
    direction: RouteDirection;
  },
  timetableStop: Pick<ScheduledStopTime, "naptanId" | "stopId" | "stopName">,
  route: NormalizedRoute,
): string | null {
  const stopId = timetableStop.naptanId || timetableStop.stopId;

  if (vehicle.nextStop) {
    if (
      vehicle.nextStop.naptanId === stopId ||
      vehicle.nextStop.id === stopId
    ) {
      return vehicle.nextStop.name;
    }
  }

  const fromRoute = resolveStopDisplayName(stopId, route, vehicle.direction);
  if (fromRoute) {
    return fromRoute;
  }

  if (!looksLikeStopId(timetableStop.stopName)) {
    return timetableStop.stopName;
  }

  return vehicle.nextStop?.name ?? null;
}

export function isStopIdLike(value: string): boolean {
  return looksLikeStopId(value);
}
