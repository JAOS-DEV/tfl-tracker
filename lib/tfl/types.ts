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
  tripId?: string;
  baseVersion?: string;
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
  vehicleRegistration?: string;
  vehicleFleetReference?: string;
  tripId?: string;
  baseVersion?: string;
  currentLocation?: string;
}

export interface ValidityPeriod {
  fromDate?: string;
  toDate?: string;
  isNow?: boolean;
}

export interface RouteStatusNotice {
  statusSeverity: number;
  statusSeverityDescription: string;
  reason?: string;
  disruption?: string;
  validityPeriods: ValidityPeriod[];
}

export interface RouteStatus {
  routeId: string;
  statusSeverity: number;
  statusSeverityDescription: string;
  reason?: string;
  disruption?: string;
  validityPeriods?: ValidityPeriod[];
  notices?: RouteStatusNotice[];
}

export interface StopDisruption {
  naptanId: string;
  stopName: string;
  type: string;
  description: string;
  fromDate?: string;
  toDate?: string;
  appearance?: string;
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

export interface StopSearchResult {
  stopPointId: string;
  name: string;
  stopLetter?: string;
  towards?: string;
  modes: string[];
  routesServed: string[];
}

export interface NearbyStopResult extends StopSearchResult {
  distanceMetres: number;
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

export type MarkerState = "live" | "possible-ghost" | "terminus-layover";

export interface EstimatedVehiclePosition {
  vehicleId: string;
  vehicleRegistration?: string;
  vehicleFleetReference?: string;
  ibusRunningNo?: string;
  ibusBlockNo?: string;
  ibusFleetNo?: string;
  tripId?: string;
  baseVersion?: string;
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
  ghostSource?: "schedule" | "feed" | "disappeared";
  isScheduledGhostCandidate?: boolean;
  scheduledGhostConfidence?: "high" | "medium" | "low";
  scheduledGhostRunningNo?: string;
  scheduledGhostBlockNo?: string;
  scheduledGhostGarageNo?: string | null;
  scheduledGhostOperatorCode?: string | null;
  scheduledGhostExpectedStopCode?: string | null;
  scheduledGhostSource?: string;
  markerState?: MarkerState;
  terminusLayoverLabel?: string;
  terminusLayoverKind?: "leg-start" | "leg-end";
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
  lastVehicleRegistration?: string;
  lastIbusRunningNo?: string;
  lastIbusBlockNo?: string;
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

export interface GhostComparisonSummary {
  routeId: string;
  currentLondonTime: string;
  routeScheduleBaseVersion: string | null;
  liveBaseVersion: string | null;
  routeScheduleLoaded: boolean;
  routeSequenceLoaded: boolean;
  liveEnrichmentComplete: boolean;
  liveTflVehicleCount: number;
  liveTflPredictionCount: number;
  uniqueLiveVehicleRegistrations: string[];
  uniqueLiveIbusRunningNumbers: string[];
  activeScheduledJourneyCount: number;
  activeScheduledRunningNumbers: string[];
  scheduledActiveRunningNumbers: string[];
  liveRunningNumbers: string[];
  matchedActiveScheduledRunningNumbers: string[];
  scheduledMissingLiveRunningNumbers: string[];
  liveRunningNumbersNotActiveInSchedule: string[];
  liveVehiclesWithoutResolvedRunningNumber: number;
  visibleScheduleGhostRunningNumbers: string[];
  visibleFeedGhostRunningNumbers: string[];
  visibleDisappearedGhostRunningNumbers: string[];
  hiddenScheduleCandidateRunningNumbers: string[];
  hiddenWeakCandidateRunningNumbers: string[];
  suppressedScheduleCandidateRunningNumbers: string[];
  routeLevelSanityCapValue: number;
  routeLevelSanityCapHiddenRunningNumbers: string[];
  sanityWarnings: string[];
  hiddenSuppressionReasonCounts: Record<string, number>;
  feedGhostLifecycleNote: string;
}

export interface GhostRunLiveMatch {
  registration?: string;
  vehicleId: string;
  tripId?: string;
  baseVersion?: string;
  blockNo?: string;
  direction: RouteDirection;
  nextStop?: string;
  expectedArrival?: string;
  displayedAsLive: boolean;
}

export interface GhostRunScheduleJourneyDiagnostic {
  tripId: string;
  blockNo: string;
  direction: string;
  startTime: string;
  endTime: string;
  active: boolean;
  inactiveReason: string | null;
  previousStopName?: string | null;
  nextStopName?: string | null;
  positionSource?: string | null;
  confidence?: string | null;
  candidateCreated: boolean;
}

export interface GhostRunDiagnostics {
  routeId: string;
  runningNo: string;
  liveMatches: GhostRunLiveMatch[];
  presentInSchedule: boolean;
  scheduleJourneyCount: number;
  activeScheduleJourneyCount: number;
  scheduleJourneys: GhostRunScheduleJourneyDiagnostic[];
  candidateCreated: boolean;
  suppressed: boolean;
  suppressionReasons: string[];
  hidden: boolean;
  hiddenReasons: string[];
  displayedAsLive: boolean;
  displayedAsScheduleGhost: boolean;
  displayedAsFeedGhost: boolean;
  displayedAsDisappearedGhost: boolean;
  finalDecision: string;
}

export interface RouteIntelligenceResult {
  vehicles: EstimatedVehiclePosition[];
  metrics: ServiceHealthMetrics;
  dashboardSummary: RouteDashboardSummary;
  scheduleGhostDiagnostics?: string[];
  ghostComparisonSummary?: GhostComparisonSummary;
  ghostRunDiagnostics?: GhostRunDiagnostics[];
}
