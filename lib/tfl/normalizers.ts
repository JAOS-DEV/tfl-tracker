import type {
  LineSearchResult,
  NearbyStopResult,
  NormalizedRoute,
  NormalizedStop,
  NormalizedVehiclePrediction,
  RouteDirection,
  RouteStatus,
  StopSearchResult,
  TflPrediction,
  TflRouteSequence,
  TflStopPoint,
} from "@/lib/tfl/types";

interface RawStopPointSequence {
  direction: string;
  stopPoint?: TflStopPoint[];
}

interface RawRouteSequence {
  lineId?: string;
  lineName?: string;
  stopPointSequences?: RawStopPointSequence[];
}

function normalizeDirection(direction: string): RouteDirection | null {
  const value = direction.toLowerCase();
  if (value.includes("inbound") || value === "inbound") {
    return "inbound";
  }
  if (value.includes("outbound") || value === "outbound") {
    return "outbound";
  }
  return null;
}

function normalizeStop(stop: TflStopPoint): NormalizedStop {
  const naptanId = stop.naptanId ?? stop.id;
  const stopLetter = stop.stopLetter ?? stop.indicator;

  return {
    id: stop.id,
    name: stop.name,
    naptanId,
    stopLetter: stopLetter || undefined,
    towards: stop.towards,
    // TODO: mark timing points when TfL sequence metadata exposes them reliably.
    isTimingPoint: false,
  };
}

function dedupeStops(stops: NormalizedStop[]): NormalizedStop[] {
  const seen = new Set<string>();
  return stops.filter((stop) => {
    if (seen.has(stop.naptanId)) {
      return false;
    }
    seen.add(stop.naptanId);
    return true;
  });
}

function extractSequences(raw: RawRouteSequence): {
  inbound: NormalizedStop[];
  outbound: NormalizedStop[];
} {
  const inbound: NormalizedStop[] = [];
  const outbound: NormalizedStop[] = [];

  for (const sequence of raw.stopPointSequences ?? []) {
    const direction = normalizeDirection(sequence.direction);
    const stops = dedupeStops((sequence.stopPoint ?? []).map(normalizeStop));

    if (direction === "inbound") {
      inbound.push(...stops);
    } else if (direction === "outbound") {
      outbound.push(...stops);
    }
  }

  return {
    inbound: dedupeStops(inbound),
    outbound: dedupeStops(outbound),
  };
}

export function normalizeRouteSequence(
  routeId: string,
  raw: RawRouteSequence | RawRouteSequence[],
): NormalizedRoute {
  const payload = Array.isArray(raw) ? raw[0] : raw;
  const { inbound, outbound } = extractSequences(payload);

  return {
    routeId,
    routeName: payload.lineName ?? routeId,
    inbound,
    outbound,
  };
}

export function toTflRouteSequence(route: NormalizedRoute): TflRouteSequence {
  return {
    lineId: route.routeId,
    lineName: route.routeName,
    inbound: route.inbound.map((stop) => ({
      id: stop.id,
      name: stop.name,
      lat: 0,
      lon: 0,
      naptanId: stop.naptanId,
      stopLetter: stop.stopLetter,
      towards: stop.towards,
    })),
    outbound: route.outbound.map((stop) => ({
      id: stop.id,
      name: stop.name,
      lat: 0,
      lon: 0,
      naptanId: stop.naptanId,
      stopLetter: stop.stopLetter,
      towards: stop.towards,
    })),
  };
}

export function normalizePredictions(
  predictions: TflPrediction[],
): NormalizedVehiclePrediction[] {
  return predictions.map((prediction) => ({
    id: prediction.id,
    routeId: prediction.lineId,
    routeNumber: prediction.lineName || prediction.lineId,
    naptanId: prediction.naptanId,
    stopName: prediction.stationName,
    destinationName: prediction.destinationName,
    direction: normalizeDirection(prediction.direction) ?? "outbound",
    timeToStation: prediction.timeToStation,
    expectedArrival: prediction.expectedArrival,
    vehicleId: prediction.vehicleId,
    currentLocation: prediction.currentLocation,
  }));
}

export function groupPredictionsByVehicle(
  predictions: NormalizedVehiclePrediction[],
): Map<string, NormalizedVehiclePrediction[]> {
  const grouped = new Map<string, NormalizedVehiclePrediction[]>();

  for (const prediction of predictions) {
    const key = prediction.vehicleId ?? prediction.id;
    const existing = grouped.get(key) ?? [];
    existing.push(prediction);
    grouped.set(key, existing);
  }

  return grouped;
}

export function predictionsForStop(
  predictions: NormalizedVehiclePrediction[],
  naptanId: string,
): NormalizedVehiclePrediction[] {
  return predictions
    .filter((prediction) => prediction.naptanId === naptanId)
    .sort((a, b) => a.timeToStation - b.timeToStation);
}

export function predictionsForDirection(
  predictions: NormalizedVehiclePrediction[],
  stopNaptanIds: string[],
): NormalizedVehiclePrediction[] {
  const stopSet = new Set(stopNaptanIds);
  return predictions.filter((prediction) => stopSet.has(prediction.naptanId));
}

interface RawLineSearchMatch {
  lineId: string;
  lineName: string;
  mode: string;
}

interface RawLineSearchResponse {
  searchMatches: RawLineSearchMatch[];
}

export function normalizeLineSearch(
  raw: RawLineSearchResponse | LineSearchResult[],
): LineSearchResult[] {
  const matches = Array.isArray(raw)
    ? raw.map((line) => ({
        lineId: line.id,
        lineName: line.name,
        mode: line.modeName,
      }))
    : raw.searchMatches;

  return matches
    .filter((line) => line.mode.toLowerCase() === "bus")
    .map((line) => ({
      id: line.lineId,
      name: line.lineName,
      modeName: line.mode,
    }));
}

export function normalizeLineStatus(
  routeId: string,
  raw: Array<{
    lineStatuses?: Array<{
      statusSeverity: number;
      statusSeverityDescription: string;
      reason?: string;
    }>;
    disruptions?: Array<{
      categoryDescription?: string;
      description?: string;
      summary?: string;
    }>;
  }>,
): RouteStatus {
  const line = raw[0];
  const primary = line?.lineStatuses?.[0];
  const disruption = line?.disruptions?.[0];
  const disruptionText =
    disruption?.summary ??
    disruption?.description ??
    disruption?.categoryDescription;

  return {
    routeId,
    statusSeverity: primary?.statusSeverity ?? 10,
    statusSeverityDescription:
      primary?.statusSeverityDescription ?? "Unknown",
    reason: primary?.reason,
    disruption: disruptionText,
  };
}

interface RawStopSearchItem {
  id?: string;
  naptanId?: string;
  name?: string;
  commonName?: string;
  indicator?: string;
  stopLetter?: string;
  towards?: string;
  modes?: string[];
  lines?: Array<string | { id?: string; name?: string }>;
  distance?: number;
}

function extractRoutesServed(lines: RawStopSearchItem["lines"]): string[] {
  if (!lines) {
    return [];
  }

  const routes: string[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const value =
      typeof line === "string"
        ? line
        : line.name ?? line.id;
    if (!value) {
      continue;
    }
    const normalized = value.trim();
    if (!normalized || seen.has(normalized.toLowerCase())) {
      continue;
    }
    seen.add(normalized.toLowerCase());
    routes.push(normalized);
  }

  return routes.slice(0, 8);
}

function normalizeStopSearchItem(stop: RawStopSearchItem): StopSearchResult {
  return {
    stopPointId: stop.id ?? stop.naptanId ?? "",
    name: stop.name ?? stop.commonName ?? "Unknown stop",
    stopLetter: stop.stopLetter ?? stop.indicator,
    towards: stop.towards,
    modes: stop.modes ?? [],
    routesServed: extractRoutesServed(stop.lines),
  };
}

function isBusStop(stop: RawStopSearchItem): boolean {
  return (stop.modes ?? []).some((mode) => mode.toLowerCase() === "bus");
}

export function normalizeStopSearch(
  raw: RawStopSearchItem[],
): StopSearchResult[] {
  const seen = new Set<string>();

  return raw
    .filter(isBusStop)
    .map(normalizeStopSearchItem)
    .filter((stop) => stop.stopPointId.length > 0)
    .filter((stop) => {
      if (seen.has(stop.stopPointId)) {
        return false;
      }
      seen.add(stop.stopPointId);
      return true;
    });
}

export function normalizeNearbyStops(
  raw: RawStopSearchItem[],
): NearbyStopResult[] {
  const seen = new Set<string>();
  const results: NearbyStopResult[] = [];

  for (const item of raw) {
    if (!isBusStop(item)) {
      continue;
    }

    const stop = normalizeStopSearchItem(item);
    if (!stop.stopPointId || seen.has(stop.stopPointId)) {
      continue;
    }

    seen.add(stop.stopPointId);
    results.push({
      ...stop,
      distanceMetres: item.distance ?? 0,
    });
  }

  return results.sort((left, right) => left.distanceMetres - right.distanceMetres);
}

export function getDestinationSummary(
  route: NormalizedRoute,
  direction: RouteDirection,
): string {
  const stops = direction === "inbound" ? route.inbound : route.outbound;
  if (stops.length === 0) {
    return "No stops available";
  }

  const first = stops[0]?.name ?? route.routeName;
  const last = stops[stops.length - 1]?.name ?? route.routeName;
  return `${first} → ${last}`;
}
