import { looksLikeRouteNumber, normalizeDiscoveryQuery } from "@/lib/discoverySearch";
import { isFleetReference } from "@/lib/vehicles/lookupKey";
import {
  isUkRegistrationPlate,
  normalizeRegistration,
  normalizeUkRegistrationCandidate,
} from "@/lib/vehicles/registration";
import type {
  EstimatedVehiclePosition,
  RouteDirection,
  ScheduleStatus,
} from "@/lib/tfl/types";

/**
 * Vehicle, fleet, and running-number search is active-route-only.
 *
 * Global vehicle/running-number search would require either querying many routes
 * or maintaining a live server-side index. To keep the app free and lightweight,
 * current vehicle search reads buses already loaded on routes you have open.
 *
 * TODO(backlog): server-side live vehicle index or safe TfL feed discovery for
 * global registration/fleet/running search.
 */
export const VEHICLE_SEARCH_PLACEHOLDER =
  "Search route, stop, or live vehicle on active routes";

export const VEHICLE_SEARCH_HELP_TEXT =
  "Vehicle, fleet, and running-number search currently checks active routes only.";

export const VEHICLE_SEARCH_LIVE_VEHICLES_GROUP_LABEL =
  "Live vehicles on active routes";

export const VEHICLE_SEARCH_RUNNING_NUMBERS_GROUP_LABEL =
  "Running numbers on active routes";

export const VEHICLE_SEARCH_NO_ACTIVE_ROUTES_MESSAGE =
  "Open a route first to search live vehicles, fleet numbers, or running numbers.";

export const VEHICLE_SEARCH_ROUTE_ASSIST_HINT =
  "Try opening the route this bus is on, then search again.";

export type VehicleSearchEmptyKind =
  | "running"
  | "registration"
  | "fleet"
  | "generic"
  | "no-active-routes";

export interface VehicleSearchEmptyStateContent {
  title: string;
  detail?: string;
  hint?: string;
}

export type VehicleSearchQueryKind =
  | "route"
  | "registration"
  | "fleet"
  | "running"
  | "location";

export type VehicleSearchResultKind =
  | "vehicle"
  | "running"
  | "fleet"
  | "registration";

export interface VehicleSearchResult {
  kind: VehicleSearchResultKind;
  routeId: string;
  direction?: RouteDirection;
  destination?: string;
  vehicleId?: string;
  registration?: string;
  fleetNumber?: string;
  runningNumber?: string;
  blockNumber?: string;
  operator?: string;
  nextStopName?: string;
  nextStopId?: string;
  timingStatus?: ScheduleStatus;
  deviationMinutes?: number | null;
  selectedBaseVersion?: string;
  matchScore: number;
}

export interface VehicleSearchCandidate {
  routeId: string;
  routeName?: string;
  vehicle: EstimatedVehiclePosition;
}

export interface VehicleSearchFocus {
  requestId: string;
  routeId: string;
  vehicleId?: string;
  direction?: RouteDirection;
  note: string;
}

const NUMERIC_QUERY_PATTERN = /^\d{1,4}$/;

export function normalizeRegistrationQuery(value: string): string {
  return normalizeRegistration(value);
}

export function normalizeFleetQuery(value: string): string {
  return normalizeRegistration(value);
}

export function normalizeRunningQuery(value: string): string {
  return value.trim();
}

export function looksLikePartialRegistration(query: string): boolean {
  const normalized = normalizeRegistrationQuery(query);
  if (normalized.length < 4 || normalized.length > 8) {
    return false;
  }
  if (NUMERIC_QUERY_PATTERN.test(normalized)) {
    return false;
  }
  if (isFleetReference(normalized)) {
    return false;
  }
  return /^[A-Z0-9]+$/.test(normalized) && /[A-Z]/.test(normalized) && /\d/.test(normalized);
}

export function detectVehicleSearchQueryKinds(query: string): VehicleSearchQueryKind[] {
  const normalized = normalizeDiscoveryQuery(query);
  if (!normalized) {
    return [];
  }

  const compact = normalizeRegistrationQuery(normalized);
  const kinds: VehicleSearchQueryKind[] = [];

  if (looksLikeRouteNumber(normalized)) {
    kinds.push("route");
  }

  if (
    isUkRegistrationPlate(compact) ||
    normalizeUkRegistrationCandidate(compact) !== undefined ||
    looksLikePartialRegistration(compact)
  ) {
    kinds.push("registration");
  }

  if (isFleetReference(compact)) {
    kinds.push("fleet");
  }

  if (NUMERIC_QUERY_PATTERN.test(normalized)) {
    kinds.push("running");
    if (!kinds.includes("fleet")) {
      kinds.push("fleet");
    }
  }

  if (kinds.length === 0) {
    kinds.push("location");
  }

  return kinds;
}

export function isVehicleOnlyDiscoveryQuery(query: string): boolean {
  const kinds = detectVehicleSearchQueryKinds(query);
  if (kinds.length === 0) {
    return false;
  }

  return (
    !kinds.includes("location") &&
    !kinds.includes("route") &&
    (kinds.includes("registration") || kinds.includes("fleet"))
  );
}

export function shouldSearchActiveVehicles(query: string): boolean {
  const kinds = detectVehicleSearchQueryKinds(query);
  return (
    kinds.includes("registration") ||
    kinds.includes("fleet") ||
    kinds.includes("running")
  );
}

function resolveVehicleRegistration(
  vehicle: EstimatedVehiclePosition,
): string | undefined {
  return (
    vehicle.vehicleRegistration ??
    normalizeUkRegistrationCandidate(vehicle.vehicleId)
  );
}

function resolveVehicleFleetNumber(
  vehicle: EstimatedVehiclePosition,
): string | undefined {
  return vehicle.ibusFleetNo ?? vehicle.vehicleFleetReference;
}

function resolveVehicleRunningNumber(
  vehicle: EstimatedVehiclePosition,
): string | undefined {
  return vehicle.ibusRunningNo ?? vehicle.scheduledGhostRunningNo;
}

function resolveVehicleOperator(
  vehicle: EstimatedVehiclePosition,
): string | undefined {
  return vehicle.scheduledGhostOperatorCode ?? undefined;
}

function isSearchableVehicleForMatch(
  vehicle: EstimatedVehiclePosition,
  scores: {
    registration: number;
    fleet: number;
    running: number;
  },
): boolean {
  if (!vehicle.isScheduledGhostCandidate) {
    return true;
  }

  // Schedule ghosts have running numbers but no live registration/fleet feed.
  return scores.running >= 0;
}

function matchScoreForExactPrefix(
  fieldValue: string | undefined,
  query: string,
  exactScore: number,
  prefixScore: number,
): number {
  if (!fieldValue) {
    return -1;
  }

  const normalizedField = fieldValue.toUpperCase();
  const normalizedQuery = query.toUpperCase();

  if (normalizedField === normalizedQuery) {
    return exactScore;
  }

  if (
    normalizedQuery.length >= 3 &&
    normalizedField.startsWith(normalizedQuery)
  ) {
    return prefixScore;
  }

  return -1;
}

function matchRegistration(
  vehicle: EstimatedVehiclePosition,
  query: string,
): number {
  const registration = resolveVehicleRegistration(vehicle);
  return matchScoreForExactPrefix(registration, query, 100, 80);
}

function matchFleet(
  vehicle: EstimatedVehiclePosition,
  query: string,
): number {
  const fleet = resolveVehicleFleetNumber(vehicle);
  const score = matchScoreForExactPrefix(fleet, query, 90, 70);
  if (score >= 0) {
    return score;
  }

  if (isFleetReference(query) && vehicle.vehicleId.toUpperCase() === query.toUpperCase()) {
    return 85;
  }

  return -1;
}

function matchRunning(
  vehicle: EstimatedVehiclePosition,
  query: string,
): number {
  const running = resolveVehicleRunningNumber(vehicle);
  return matchScoreForExactPrefix(running, query, 88, 60);
}

function resolveResultKind(
  kinds: VehicleSearchQueryKind[],
  scores: {
    registration: number;
    fleet: number;
    running: number;
  },
): VehicleSearchResultKind {
  const candidates: Array<{ kind: VehicleSearchResultKind; score: number }> = [];

  if (kinds.includes("registration") && scores.registration >= 0) {
    candidates.push({ kind: "registration", score: scores.registration });
  }
  if (kinds.includes("fleet") && scores.fleet >= 0) {
    candidates.push({ kind: "fleet", score: scores.fleet });
  }
  if (kinds.includes("running") && scores.running >= 0) {
    candidates.push({ kind: "running", score: scores.running });
  }

  candidates.sort((left, right) => right.score - left.score);
  return candidates[0]?.kind ?? "vehicle";
}

function buildVehicleSearchResult(
  candidate: VehicleSearchCandidate,
  kind: VehicleSearchResultKind,
  matchScore: number,
): VehicleSearchResult {
  const { vehicle, routeId } = candidate;

  return {
    kind,
    routeId,
    direction: vehicle.direction,
    destination: vehicle.destinationName,
    vehicleId: vehicle.vehicleId,
    registration: resolveVehicleRegistration(vehicle),
    fleetNumber: resolveVehicleFleetNumber(vehicle),
    runningNumber: resolveVehicleRunningNumber(vehicle),
    blockNumber: vehicle.ibusBlockNo ?? vehicle.scheduledGhostBlockNo,
    operator: resolveVehicleOperator(vehicle),
    nextStopName: vehicle.nextStop?.name,
    nextStopId: vehicle.nextStop?.naptanId,
    timingStatus: vehicle.scheduleStatus,
    deviationMinutes: vehicle.scheduleDeviationMinutes,
    selectedBaseVersion: vehicle.baseVersion,
    matchScore,
  };
}

export function searchActiveVehicleCandidates(
  candidates: VehicleSearchCandidate[],
  query: string,
): VehicleSearchResult[] {
  const normalized = normalizeDiscoveryQuery(query);
  if (!normalized || candidates.length === 0) {
    return [];
  }

  const kinds = detectVehicleSearchQueryKinds(normalized);
  if (!shouldSearchActiveVehicles(normalized)) {
    return [];
  }

  const registrationQuery = normalizeRegistrationQuery(normalized);
  const fleetQuery = normalizeFleetQuery(normalized);
  const runningQuery = normalizeRunningQuery(normalized);

  const results: VehicleSearchResult[] = [];

  for (const candidate of candidates) {
    const registrationScore = kinds.includes("registration")
      ? matchRegistration(candidate.vehicle, registrationQuery)
      : -1;
    const fleetScore = kinds.includes("fleet")
      ? matchFleet(candidate.vehicle, fleetQuery)
      : -1;
    const runningScore = kinds.includes("running")
      ? matchRunning(candidate.vehicle, runningQuery)
      : -1;

    const bestScore = Math.max(registrationScore, fleetScore, runningScore);
    if (bestScore < 0) {
      continue;
    }

    if (
      !isSearchableVehicleForMatch(candidate.vehicle, {
        registration: registrationScore,
        fleet: fleetScore,
        running: runningScore,
      })
    ) {
      continue;
    }

    const kind = resolveResultKind(kinds, {
      registration: registrationScore,
      fleet: fleetScore,
      running: runningScore,
    });

    results.push(
      buildVehicleSearchResult(candidate, kind, bestScore),
    );
  }

  return rankVehicleSearchResults(results);
}

export function rankVehicleSearchResults(
  results: VehicleSearchResult[],
): VehicleSearchResult[] {
  return [...results].sort((left, right) => {
    if (right.matchScore !== left.matchScore) {
      return right.matchScore - left.matchScore;
    }

    const routeCompare = left.routeId.localeCompare(right.routeId, undefined, {
      numeric: true,
      sensitivity: "base",
    });
    if (routeCompare !== 0) {
      return routeCompare;
    }

    return (left.vehicleId ?? "").localeCompare(right.vehicleId ?? "");
  });
}

export function groupVehicleSearchResults(results: VehicleSearchResult[]): {
  liveVehicles: VehicleSearchResult[];
  runningNumbers: VehicleSearchResult[];
} {
  const runningNumbers = results.filter((result) => result.kind === "running");
  const liveVehicles = results.filter((result) => result.kind !== "running");

  return {
    liveVehicles,
    runningNumbers,
  };
}

export function formatVehicleSearchTimingLabel(
  result: VehicleSearchResult,
): string | null {
  if (result.timingStatus === "unknown" || result.timingStatus === undefined) {
    return null;
  }

  const deviation = result.deviationMinutes;
  if (deviation === null || deviation === undefined) {
    return result.timingStatus === "onTime" ? "On time" : null;
  }

  if (result.timingStatus === "onTime") {
    return "On time";
  }

  const prefix =
    result.timingStatus === "late"
      ? "Late"
      : result.timingStatus === "early"
        ? "Early"
        : null;
  if (!prefix) {
    return null;
  }

  const sign = deviation > 0 ? "+" : "";
  return `${prefix} ${sign}${deviation}`;
}

export function formatVehicleSearchPrimaryLine(
  result: VehicleSearchResult,
): string {
  const parts = [`Route ${result.routeId}`];

  if (result.runningNumber) {
    parts.push(`Run ${result.runningNumber}`);
  }
  if (result.registration) {
    parts.push(result.registration);
  }
  if (result.fleetNumber) {
    parts.push(`Fleet ${result.fleetNumber}`);
  }

  return parts.join(" · ");
}

export function formatVehicleSearchSecondaryLine(
  result: VehicleSearchResult,
): string | null {
  const parts: string[] = [];

  const timing = formatVehicleSearchTimingLabel(result);
  if (timing) {
    parts.push(timing);
  }

  if (result.nextStopName) {
    parts.push(`next ${result.nextStopName}`);
  }

  if (result.destination) {
    parts.push(`towards ${result.destination}`);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

export function resolveVehicleSearchEmptyKind(
  query: string,
  activeRouteCount: number,
): VehicleSearchEmptyKind {
  if (activeRouteCount === 0) {
    return "no-active-routes";
  }

  const normalized = normalizeDiscoveryQuery(query);
  const compact = normalizeRegistrationQuery(normalized);
  const kinds = detectVehicleSearchQueryKinds(normalized);

  if (isVehicleOnlyDiscoveryQuery(normalized)) {
    if (
      isUkRegistrationPlate(compact) ||
      normalizeUkRegistrationCandidate(compact) !== undefined
    ) {
      return "registration";
    }

    if (isFleetReference(compact)) {
      return "fleet";
    }
  }

  if (NUMERIC_QUERY_PATTERN.test(normalized) && kinds.includes("running")) {
    return "running";
  }

  if (kinds.includes("registration") && !looksLikeRouteNumber(normalized)) {
    return "registration";
  }

  if (kinds.includes("fleet") && isFleetReference(compact)) {
    return "fleet";
  }

  return "generic";
}

export function buildVehicleSearchEmptyState(
  query: string,
  activeRouteCount: number,
): VehicleSearchEmptyStateContent {
  const kind = resolveVehicleSearchEmptyKind(query, activeRouteCount);
  const normalized = normalizeDiscoveryQuery(query);

  if (kind === "no-active-routes") {
    return {
      title: VEHICLE_SEARCH_NO_ACTIVE_ROUTES_MESSAGE,
      hint: "Search a route first, then try your vehicle query again.",
    };
  }

  if (kind === "running") {
    return {
      title: `No live bus with run ${normalized} found on active routes.`,
      detail: "Add the route first, then search again.",
      hint: VEHICLE_SEARCH_ROUTE_ASSIST_HINT,
    };
  }

  if (kind === "registration") {
    return {
      title: `No active-route match for ${normalizeRegistrationQuery(normalized)}.`,
      detail: "Vehicle search checks buses on routes you have opened.",
      hint: VEHICLE_SEARCH_ROUTE_ASSIST_HINT,
    };
  }

  if (kind === "fleet") {
    return {
      title: `No active-route match for fleet ${normalizeFleetQuery(normalized)}.`,
      detail: "Open the route first to search live vehicles on it.",
      hint: VEHICLE_SEARCH_ROUTE_ASSIST_HINT,
    };
  }

  return {
    title: `No live vehicle match for "${normalized}" on active routes.`,
    hint: VEHICLE_SEARCH_ROUTE_ASSIST_HINT,
  };
}

export function buildRunningNumberEmptyMessage(runningNumber: string): string {
  return buildVehicleSearchEmptyState(runningNumber, 1).title;
}

export function shouldShowVehicleSearchEmptyState(
  query: string,
  activeRouteCount: number,
  resultCount: number,
  options?: { routeDiscoveryResultCount?: number },
): boolean {
  if (
    resultCount === 0 &&
    (options?.routeDiscoveryResultCount ?? 0) > 0 &&
    looksLikeRouteNumber(query)
  ) {
    return false;
  }

  return (
    resultCount === 0 &&
    query.trim().length >= 2 &&
    shouldSearchActiveVehicles(query)
  );
}

export function createVehicleSearchFocus(
  result: VehicleSearchResult,
  requestId: string,
): VehicleSearchFocus {
  const labelParts = [
    result.registration,
    result.fleetNumber ? `fleet ${result.fleetNumber}` : undefined,
    result.runningNumber ? `run ${result.runningNumber}` : undefined,
  ].filter(Boolean);

  return {
    requestId,
    routeId: result.routeId,
    vehicleId: result.vehicleId,
    direction: result.direction,
    note:
      labelParts.length > 0
        ? `Matched vehicle: ${labelParts.join(" · ")}`
        : "Matched vehicle from search",
  };
}

export function vehicleCandidateFromPosition(
  routeId: string,
  vehicle: EstimatedVehiclePosition,
  routeName?: string,
): VehicleSearchCandidate {
  return {
    routeId,
    routeName,
    vehicle,
  };
}
