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
export type ScheduleStatus = "early" | "onTime" | "late" | "unknown";
export type ScheduleMatchConfidence = "high" | "medium" | "low" | "unknown";
export type GhostStatus =
  | "normal"
  | "missingLatest"
  | "disappeared"
  | "suspectedGhost"
  | "reappeared"
  | "stale";

export interface ScheduledStopTime {
  stopId: string;
  naptanId: string;
  stopName: string;
  scheduledArrival: string;
}

export interface ScheduledJourney {
  journeyId: string;
  direction: RouteDirection;
  destinationName?: string;
  departureTime: string;
  intervalId?: string;
  stopTimes: ScheduledStopTime[];
}

export interface NormalizedTimetable {
  routeId: string;
  direction: RouteDirection;
  fromStopPointId: string;
  available: boolean;
  unavailableReason?: string;
  journeys: ScheduledJourney[];
}

export interface ScheduleDeviation {
  deviationMinutes: number | null;
  scheduleStatus: ScheduleStatus;
  scheduleStatusLabel: string;
  scheduleMatchConfidence: ScheduleMatchConfidence;
  matchedScheduledTime: string | null;
  matchedStopName: string | null;
  scheduleDataAvailable: boolean;
  scheduleExplanation?: string;
}

export interface VehicleScheduleMatch extends ScheduleDeviation {
  matchedJourneyId?: string;
}

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
  predictionConfidence?: PredictionConfidence;
  scheduleDeviationMinutes: number | null;
  scheduleStatus: ScheduleStatus;
  scheduleStatusLabel: string;
  scheduleMatchConfidence: ScheduleMatchConfidence;
  matchedScheduledTime: string | null;
  matchedStopName: string | null;
  scheduleDataAvailable: boolean;
  scheduleExplanation?: string;
  ghostStatus: GhostStatus;
  ghostReason?: string;
  lastSeenAt?: number;
  missedRefreshCount: number;
  reappearedAt?: number;
  isSuspectedGhost: boolean;
}

export interface RouteAlertBadge {
  id: string;
  label: string;
  tone: "info" | "warning" | "neutral" | "success" | "danger";
}

export type PredictionConfidence =
  | "normal"
  | "stale"
  | "missing"
  | "disappeared"
  | "reappeared";

export interface PredictionTrackingState {
  key: string;
  vehicleId: string;
  missingRefreshCount: number;
  lastSeenAt: number;
  justReappeared: boolean;
  lastTimeToStation?: number;
  wasDueSoon: boolean;
  reappearedAt?: number;
  lastPrediction?: NormalizedVehiclePrediction;
  lastProgress?: number;
  lastX?: number;
  lastY?: number;
}

export interface VehicleGap {
  fromVehicleId: string;
  toVehicleId: string;
  gapMinutes: number;
  direction: RouteDirection;
  fromProgress: number;
  toProgress: number;
}

export interface BunchingCluster {
  direction: RouteDirection;
  vehicleIds: string[];
  centerProgress: number;
  centerX: number;
  centerY: number;
}

export interface LargeGapSegment {
  direction: RouteDirection;
  fromProgress: number;
  toProgress: number;
  gapMinutes: number;
  fromVehicleId: string;
  toVehicleId: string;
}

export interface DirectionIntelligence {
  direction: RouteDirection;
  liveVehicleCount: number;
  averageGapMinutes: number | null;
  largestGapMinutes: number | null;
  smallestGapMinutes: number | null;
  bunchingClusterCount: number;
  largeGapCount: number;
}

export interface ServiceHealthMetrics {
  liveVehicleCount: number;
  averageGapMinutes: number | null;
  largestGapMinutes: number | null;
  smallestGapMinutes: number | null;
  bunchingClusterCount: number;
  largeGapCount: number;
  stalePredictionCount: number;
  disappearedPredictionCount: number;
  missingFromRefreshCount: number;
  isDataStale: boolean;
  healthScore: number;
  healthLabel: string;
  estimatedLateCount: number;
  estimatedEarlyCount: number;
  estimatedOnTimeCount: number;
  unknownScheduleMatchCount: number;
  averageScheduleDeviationMinutes: number | null;
  possibleGhostCount: number;
  predictionDisappearedCount: number;
  missingLatestCount: number;
  reappearedCount: number;
  outbound: DirectionIntelligence;
  inbound: DirectionIntelligence;
}

export interface RouteDashboardSummary {
  routeId: string;
  healthScore: number;
  healthLabel: string;
  liveVehicleCount: number;
  largestGapMinutes: number | null;
  largeGapCount: number;
  bunchingClusterCount: number;
  isDataStale: boolean;
  disappearedPredictionCount: number;
  missingFromRefreshCount: number;
  stalePredictionCount: number;
  estimatedLateCount: number;
  estimatedEarlyCount: number;
  estimatedOnTimeCount: number;
  unknownScheduleMatchCount: number;
  possibleGhostCount: number;
  predictionDisappearedCount: number;
  missingLatestCount: number;
}

export interface RouteIntelligenceResult {
  vehicles: EstimatedVehiclePosition[];
  metrics: ServiceHealthMetrics;
  dashboardSummary: RouteDashboardSummary;
}
