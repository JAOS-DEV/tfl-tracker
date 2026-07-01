import { extractVehicleRegistration } from "@/lib/vehicles/registration";
import { extractVehicleFleetReference } from "@/lib/vehicles/lookupKey";
import { isBusModePrediction, isTfLBusStopCandidate } from "@/lib/busStops";
import { normalizeStopLetterDisplay } from "@/lib/stopDisplay";
import type {
  LineSearchResult,
  NearbyStopResult,
  NormalizedRoute,
  NormalizedStop,
  NormalizedVehiclePrediction,
  RouteDirection,
  RouteGeoPoint,
  RoutePathsByDirection,
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
  lineStrings?: string[];
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

function isValidStopCoordinate(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180 &&
    !(lat === 0 && lon === 0)
  );
}

function normalizeStop(stop: TflStopPoint): NormalizedStop {
  const naptanId = stop.naptanId ?? stop.id;
  const stopLetter = stop.stopLetter ?? stop.indicator;
  const hasCoordinates = isValidStopCoordinate(stop.lat, stop.lon);

  return {
    id: stop.id,
    name: stop.name,
    naptanId,
    stopLetter: stopLetter || undefined,
    towards: stop.towards,
    ...(hasCoordinates ? { lat: stop.lat, lon: stop.lon } : {}),
    // TODO: mark timing points when TfL sequence metadata exposes them reliably.
    isTimingPoint: false,
    isQsiPoint: false,
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

function isValidRouteCoordinate(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number" &&
    isValidStopCoordinate(value[1], value[0])
  );
}

function parseRoutePaths(value: string | undefined): RouteGeoPoint[][] {
  if (!value) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(
        (path): path is [number, number][] =>
          Array.isArray(path) &&
          path.length >= 2 &&
          path.every(isValidRouteCoordinate),
      )
      .map((path) => path.map(([lon, lat]) => ({ lat, lon })));
  } catch {
    return [];
  }
}

function extractRoutePaths(raw: RawRouteSequence): RoutePathsByDirection | undefined {
  const routePaths: RoutePathsByDirection = {};

  for (const [index, sequence] of (raw.stopPointSequences ?? []).entries()) {
    const direction = normalizeDirection(sequence.direction);
    if (!direction) {
      continue;
    }

    const paths = parseRoutePaths(raw.lineStrings?.[index]);
    if (paths.length > 0) {
      routePaths[direction] = [...(routePaths[direction] ?? []), ...paths];
    }
  }

  return routePaths.inbound || routePaths.outbound ? routePaths : undefined;
}

export function normalizeRouteSequence(
  routeId: string,
  raw: RawRouteSequence | RawRouteSequence[],
): NormalizedRoute {
  const payload = Array.isArray(raw) ? raw[0] : raw;
  const { inbound, outbound } = extractSequences(payload);
  const routePaths = extractRoutePaths(payload);

  return {
    routeId,
    routeName: payload.lineName ?? routeId,
    inbound,
    outbound,
    ...(routePaths ? { routePaths } : {}),
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
    timestamp: prediction.timestamp,
    vehicleId: prediction.vehicleId,
    vehicleRegistration: extractVehicleRegistration(prediction.vehicleId),
    vehicleFleetReference: extractVehicleFleetReference(prediction.vehicleId),
    tripId: prediction.tripId,
    baseVersion: prediction.baseVersion,
    currentLocation: prediction.currentLocation,
  }));
}

export function normalizeBusPredictions(
  predictions: TflPrediction[],
): NormalizedVehiclePrediction[] {
  return normalizePredictions(predictions.filter(isBusModePrediction));
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

function normalizeStatusNotice(
  status: {
    statusSeverity: number;
    statusSeverityDescription: string;
    reason?: string;
    validityPeriods?: Array<{
      fromDate?: string;
      toDate?: string;
      isNow?: boolean;
    }>;
    disruption?: {
      categoryDescription?: string;
      description?: string;
      summary?: string;
    };
  },
): {
  statusSeverity: number;
  statusSeverityDescription: string;
  reason?: string;
  disruption?: string;
  validityPeriods: Array<{
    fromDate?: string;
    toDate?: string;
    isNow?: boolean;
  }>;
} {
  const disruptionText =
    status.disruption?.summary ??
    status.disruption?.description ??
    status.disruption?.categoryDescription;

  return {
    statusSeverity: status.statusSeverity,
    statusSeverityDescription: status.statusSeverityDescription,
    reason: status.reason,
    disruption: disruptionText,
    validityPeriods: status.validityPeriods ?? [],
  };
}

export function normalizeLineStatus(
  routeId: string,
  raw: Array<{
    lineStatuses?: Array<{
      statusSeverity: number;
      statusSeverityDescription: string;
      reason?: string;
      validityPeriods?: Array<{
        fromDate?: string;
        toDate?: string;
        isNow?: boolean;
      }>;
      disruption?: {
        categoryDescription?: string;
        description?: string;
        summary?: string;
      };
    }>;
    disruptions?: Array<{
      categoryDescription?: string;
      description?: string;
      summary?: string;
    }>;
  }>,
): RouteStatus {
  const line = raw[0];
  const statuses = line?.lineStatuses ?? [];
  const notices = statuses
    .filter(
      (status) =>
        status.statusSeverity < 10 ||
        Boolean(status.reason) ||
        Boolean(status.disruption?.description),
    )
    .map(normalizeStatusNotice);

  const primary = notices[0] ?? (statuses[0] ? normalizeStatusNotice(statuses[0]) : null);
  const lineDisruption = line?.disruptions?.[0];
  const fallbackDisruptionText =
    lineDisruption?.summary ??
    lineDisruption?.description ??
    lineDisruption?.categoryDescription;

  return {
    routeId,
    statusSeverity: primary?.statusSeverity ?? 10,
    statusSeverityDescription:
      primary?.statusSeverityDescription ?? "Unknown",
    reason: primary?.reason,
    disruption: primary?.disruption ?? fallbackDisruptionText,
    validityPeriods: primary?.validityPeriods,
    notices: notices.length > 0 ? notices : undefined,
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
  stopType?: string;
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
  const stopPointId = stop.id ?? stop.naptanId ?? "";

  return {
    stopPointId,
    name: stop.name ?? stop.commonName ?? "Unknown stop",
    stopLetter: normalizeStopLetterDisplay(
      stop.stopLetter ?? stop.indicator,
      stopPointId,
    ),
    towards: stop.towards,
    modes: stop.modes ?? [],
    routesServed: extractRoutesServed(stop.lines),
  };
}

function isBusStop(stop: RawStopSearchItem): boolean {
  return isTfLBusStopCandidate(stop);
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
