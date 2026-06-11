import type { FavouriteStop } from "@/lib/favouriteStops";
import type { NormalizedStop } from "@/lib/tfl/types";

export interface StopDetailTarget {
  stopPointId: string;
  name: string;
  stopLetter?: string;
  routesServed?: string[];
}

export function toStopDetailTarget(
  stop: NormalizedStop | FavouriteStop | StopDetailTarget,
): StopDetailTarget {
  if ("naptanId" in stop) {
    return {
      stopPointId: stop.naptanId,
      name: stop.name,
      stopLetter: stop.stopLetter,
    };
  }

  return {
    stopPointId: stop.stopPointId,
    name: stop.name,
    stopLetter: stop.stopLetter,
    routesServed: stop.routesServed,
  };
}
