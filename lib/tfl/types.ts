export type RouteDirection = "inbound" | "outbound";

export interface TflStopPoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  towards?: string;
  stopLetter?: string;
  indicator?: string;
  naptanId?: string;
  modes?: string[];
}

export interface TflPrediction {
  id: string;
  lineId: string;
  lineName: string;
  naptanId: string;
  stationName: string;
  destinationName: string;
  direction: string;
  timeToStation: number;
  expectedArrival: string;
  vehicleId?: string;
  currentLocation?: string;
  towards?: string;
  modeName: string;
  timestamp: string;
}

export interface TflRouteSequence {
  lineId: string;
  lineName: string;
  inbound: TflStopPoint[];
  outbound: TflStopPoint[];
}

export interface NormalizedStop {
  id: string;
  name: string;
  naptanId: string;
  stopLetter?: string;
  towards?: string;
  isTimingPoint: boolean;
}

export interface NormalizedRoute {
  routeId: string;
  routeName: string;
  inbound: NormalizedStop[];
  outbound: NormalizedStop[];
}

export interface NormalizedVehiclePrediction {
  id: string;
  routeId: string;
  routeNumber: string;
  naptanId: string;
  stopName: string;
  destinationName: string;
  direction: RouteDirection;
  timeToStation: number;
  expectedArrival: string;
  vehicleId?: string;
  currentLocation?: string;
}

export interface RouteStatus {
  routeId: string;
  statusSeverity: number;
  statusSeverityDescription: string;
  reason?: string;
  disruption?: string;
}

export interface LineSearchResult {
  id: string;
  name: string;
  modeName: string;
  lineStatuses?: Array<{
    statusSeverity: number;
    statusSeverityDescription: string;
    reason?: string;
  }>;
}

export interface HeadwayInfo {
  nextMinutes: number | null;
  gapMinutes: number | null;
}

export interface RouteSummaryStats {
  liveVehicleCount: number;
  averageGapMinutes: number | null;
  largestGapMinutes: number | null;
  busiestStopName: string | null;
  busiestStopCount: number;
  hasLargeGap: boolean;
  hasBunching: boolean;
}

export interface ActiveRoute {
  routeId: string;
  routeName: string;
  addedAt: number;
}

export type RouteVisualMode = "list" | "loop";

export interface LoopStopNode {
  stop: NormalizedStop;
  direction: RouteDirection;
  index: number;
  progress: number;
  isTerminal: boolean;
  shouldLabel: boolean;
}

export interface LoopStopsLayout {
  outbound: LoopStopNode[];
  inbound: LoopStopNode[];
}

export type ScheduleAdherence = "onTime" | "late" | "early";

export interface EstimatedVehiclePosition {
  vehicleId: string;
  routeNumber: string;
  direction: RouteDirection;
  destinationName: string;
  currentLocation?: string;
  expectedArrival: string;
  timeToStation: number;
  nextPrediction: NormalizedVehiclePrediction;
  nextStop: NormalizedStop | null;
  stopIndex: number;
  progress: number;
  x: number;
  y: number;
  matched: boolean;
  adherence: ScheduleAdherence;
}

export interface RouteAlertBadge {
  id: string;
  label: string;
  tone: "info" | "warning" | "neutral";
}
