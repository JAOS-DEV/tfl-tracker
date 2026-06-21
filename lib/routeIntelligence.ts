import type { BaseVersionSelectionResult } from "@/lib/ibus/baseVersionSelection";
import { getIbusDataDiagnostics } from "@/lib/ibus/dataUrl";
import { getIbusFetchDiagnostics } from "@/lib/ibus/fetchIbusJson";
import type { LoopLayoutConfig } from "@/lib/constants";
import { resolveGhostStatus } from "@/lib/ghostBusDetection";
import {
  liveBaseVersionMatchesStatic,
  type LiveIbusRunningDetail,
} from "@/lib/ibusLookup";
import {
  buildBlueLiveBusScheduleDiagnostics,
  countBlueUnknownLiveBuses,
  summarizeUnknownReasons,
} from "@/lib/schedulePipeline/buildLiveBusScheduleDiagnostics";
import { appendTrackedGhostVehicles } from "@/lib/ghostVehicles";
import { resolvePredictionConfidence } from "@/lib/predictionTracking";
import { buildVehiclePositions } from "@/lib/routePositioning";
import { buildLiveSchedulePool } from "@/lib/schedulePipeline/buildLiveSchedulePool";
import { enrichLiveVehicles } from "@/lib/schedulePipeline/enrichLiveVehicles";
import { generateScheduleGhosts } from "@/lib/schedulePipeline/generateScheduleGhosts";
import { runScheduleTimingPipeline } from "@/lib/schedulePipeline/runSchedulePipeline";
import type {
  IndexedVehicleTimingResult,
  ScheduleTimingDiagnostics,
} from "@/lib/schedulePipeline/types";
import { matchVehicleToSchedule } from "@/lib/scheduleDeviation";
import { resolveAdherenceFromScheduleStatus } from "@/lib/ibusScheduleDeviation";
import { buildVehicleRegistrationDiagnostics } from "@/lib/vehicleRegistrationDiagnostics";
import { buildServiceHealthMetrics } from "@/lib/serviceIntelligence";
import { attachTerminusLayoverState } from "@/lib/terminusLayover";
import type { IbusRouteSchedule } from "@/lib/ibus/scheduleTypes";
import type {
  EstimatedVehiclePosition,
  NormalizedRoute,
  NormalizedTimetable,
  NormalizedVehiclePrediction,
  PredictionTrackingState,
  RouteDashboardSummary,
  RouteDirection,
  RouteIntelligenceResult,
  ServiceHealthMetrics,
} from "@/lib/tfl/types";

export interface BuildRouteIntelligenceInput {
  routeId: string;
  route: NormalizedRoute;
  predictions: NormalizedVehiclePrediction[];
  layout: LoopLayoutConfig;
  dataUpdatedAt: number;
  now: number;
  trackingStates: Map<string, PredictionTrackingState>;
  timetables?: Partial<Record<RouteDirection, NormalizedTimetable | null>>;
  includeScheduleMatching?: boolean;
  routeSchedule?: IbusRouteSchedule | null;
  showScheduleGhosts?: boolean;
  includeLowConfidenceScheduleGhosts?: boolean;
  liveBaseVersion?: string;
  liveIbusRunningDetails?: Map<string, LiveIbusRunningDetail>;
  collectScheduleGhostDiagnostics?: boolean;
  debugScheduleRunningNo?: string;
  debugScheduleRunningNos?: string[];
  collectRegistrationDiagnostics?: boolean;
  showRegistrationEnabled?: boolean;
  enrichmentLoaded?: boolean;
  routeScheduleLoading?: boolean;
  staticManifestBaseVersion?: string;
  activeBaseVersionFromXml?: string;
  baseVersionSelection?: BaseVersionSelectionResult;
  sampleLivePrediction?: {
    rawTripId?: string;
    rawBaseVersion?: string;
    normalizedTripId?: string;
    normalizedBaseVersion?: string;
    fieldsUsedForBaseVersion: string;
  };
}

export function toRouteDashboardSummary(
  routeId: string,
  metrics: ServiceHealthMetrics,
): RouteDashboardSummary {
  return {
    routeId,
    healthScore: metrics.healthScore,
    healthLabel: metrics.healthLabel,
    liveVehicleCount: metrics.liveVehicleCount,
    largestGapMinutes: metrics.largestGapMinutes,
    largeGapCount: metrics.largeGapCount,
    bunchingClusterCount: metrics.bunchingClusterCount,
    isDataStale: metrics.isDataStale,
    disappearedPredictionCount: metrics.disappearedPredictionCount,
    missingFromRefreshCount: metrics.missingFromRefreshCount,
    stalePredictionCount: metrics.stalePredictionCount,
    estimatedLateCount: metrics.estimatedLateCount,
    estimatedEarlyCount: metrics.estimatedEarlyCount,
    estimatedOnTimeCount: metrics.estimatedOnTimeCount,
    unknownScheduleMatchCount: metrics.unknownScheduleMatchCount,
    possibleGhostCount: metrics.possibleGhostCount,
    predictionDisappearedCount: metrics.predictionDisappearedCount,
    missingLatestCount: metrics.missingLatestCount,
  };
}

function timetablesAvailable(
  timetables?: Partial<Record<RouteDirection, NormalizedTimetable | null>>,
): boolean {
  return Boolean(
    timetables?.outbound?.available || timetables?.inbound?.available,
  );
}

function attachTimetableScheduleTiming(
  positions: EstimatedVehiclePosition[],
  input: BuildRouteIntelligenceInput,
): EstimatedVehiclePosition[] {
  if (input.includeScheduleMatching === false) {
    return positions;
  }

  if (input.routeSchedule) {
    return positions;
  }

  if (timetablesAvailable(input.timetables)) {
    return matchVehicleToSchedule(
      positions,
      input.timetables ?? {},
      input.predictions,
      input.route,
    );
  }

  return positions;
}

function mergeTimingDiagnostics(
  timingDiagnostics: ScheduleTimingDiagnostics | undefined,
  ghostComparisonSummary: RouteIntelligenceResult["ghostComparisonSummary"],
): ScheduleTimingDiagnostics | undefined {
  if (!timingDiagnostics) {
    return undefined;
  }

  return {
    ...timingDiagnostics,
    ghostCandidateCount:
      ghostComparisonSummary?.hiddenScheduleCandidateRunningNumbers.length ??
      timingDiagnostics.ghostCandidateCount,
    visibleGhostCount:
      ghostComparisonSummary?.visibleScheduleGhostRunningNumbers.length ??
      timingDiagnostics.visibleGhostCount,
  };
}

function attachPredictionAndGhostState(
  vehicles: EstimatedVehiclePosition[],
  trackingStates: Map<string, PredictionTrackingState>,
  dataUpdatedAt: number,
  now: number,
): EstimatedVehiclePosition[] {
  return vehicles.map((vehicle) => {
    if (vehicle.isScheduledGhostCandidate) {
      return vehicle;
    }

    const trackingState = trackingStates.get(vehicle.vehicleId);
    const ghost = resolveGhostStatus({
      state: trackingState,
      dataUpdatedAt,
      now,
      lastTimeToStation: vehicle.timeToStation,
    });

    return {
      ...vehicle,
      predictionConfidence: resolvePredictionConfidence(
        trackingState,
        dataUpdatedAt,
        now,
      ),
      ghostStatus: ghost.ghostStatus,
      ghostReason: ghost.ghostReason,
      lastSeenAt: ghost.lastSeenAt,
      missedRefreshCount: ghost.missedRefreshCount,
      reappearedAt: ghost.reappearedAt,
      isSuspectedGhost: ghost.isSuspectedGhost,
      adherence: resolveAdherenceFromScheduleStatus(vehicle.scheduleStatus),
    };
  });
}

export function buildRouteIntelligence(
  input: BuildRouteIntelligenceInput,
): RouteIntelligenceResult {
  const positions = enrichLiveVehicles(
    buildVehiclePositions(
      input.predictions,
      input.route,
      input.layout,
    ),
    input.liveIbusRunningDetails,
  );

  const enrichedTracking = new Map(input.trackingStates);
  for (const vehicle of positions) {
    const state = enrichedTracking.get(vehicle.vehicleId);
    if (!state) {
      continue;
    }
    enrichedTracking.set(vehicle.vehicleId, {
      ...state,
      lastPrediction: vehicle.nextPrediction,
      lastProgress: vehicle.progress,
      lastX: vehicle.x,
      lastY: vehicle.y,
      lastVehicleRegistration: vehicle.vehicleRegistration,
      lastIbusRunningNo: vehicle.ibusRunningNo,
      lastIbusBlockNo: vehicle.ibusBlockNo,
    });
  }

  let vehicles = positions;
  let scheduleTimingDiagnostics: ScheduleTimingDiagnostics | undefined;
  let schedulePool: ReturnType<typeof buildLiveSchedulePool> | undefined;
  let timingResults: IndexedVehicleTimingResult[] = [];
  const runIbusScheduleWork =
    Boolean(input.routeSchedule) && input.includeScheduleMatching !== false;

  if (runIbusScheduleWork && input.routeSchedule) {
    const timingResult = runScheduleTimingPipeline({
      routeId: input.routeId,
      route: input.route,
      routeSchedule: input.routeSchedule,
      vehicles: positions,
      layout: input.layout,
      now: input.now,
      dataUpdatedAt: input.dataUpdatedAt,
      liveBaseVersion: input.liveBaseVersion,
      liveIbusRunningDetails: input.liveIbusRunningDetails,
      livePredictionCount: input.predictions.length,
      showScheduleGhosts: input.showScheduleGhosts ?? true,
      includeLowConfidence: input.includeLowConfidenceScheduleGhosts ?? false,
      collectDiagnostics: input.collectScheduleGhostDiagnostics ?? false,
      debugRunningNo: input.debugScheduleRunningNo,
      debugRunningNos: input.debugScheduleRunningNos,
      liveEnrichmentComplete:
        input.enrichmentLoaded ?? Boolean(input.liveIbusRunningDetails),
    });
    vehicles = timingResult.vehicles;
    scheduleTimingDiagnostics = timingResult.timingDiagnostics;
    schedulePool = timingResult.pool;
    timingResults = timingResult.timingResults;
  } else {
    vehicles = attachTimetableScheduleTiming(positions, input);
  }

  const withLayover = attachTerminusLayoverState(
    vehicles,
    input.route,
    input.layout,
  );

  const withTrackedGhosts = appendTrackedGhostVehicles(
    withLayover,
    enrichedTracking,
    input.dataUpdatedAt,
    input.now,
  );

  const scheduledGhostResult =
    runIbusScheduleWork && input.routeSchedule && schedulePool
      ? generateScheduleGhosts({
          routeId: input.routeId,
          route: input.route,
          layout: input.layout,
          vehicles: withTrackedGhosts,
          schedule: input.routeSchedule,
          pool: schedulePool,
          now: input.now,
          dataUpdatedAt: input.dataUpdatedAt,
          liveBaseVersion: input.liveBaseVersion,
          livePredictionCount: input.predictions.length,
          showScheduleGhosts: input.showScheduleGhosts ?? true,
          includeLowConfidence:
            input.includeLowConfidenceScheduleGhosts ?? false,
          collectDiagnostics: input.collectScheduleGhostDiagnostics ?? false,
          debugRunningNo: input.debugScheduleRunningNo,
          debugRunningNos: input.debugScheduleRunningNos,
          liveEnrichmentComplete:
            input.enrichmentLoaded ?? Boolean(input.liveIbusRunningDetails),
        })
      : {
          vehicles: withTrackedGhosts,
          diagnostics: [] as string[],
        };

  scheduleTimingDiagnostics = mergeTimingDiagnostics(
    scheduleTimingDiagnostics,
    scheduledGhostResult.ghostComparisonSummary,
  );

  const finalVehicles = attachPredictionAndGhostState(
    scheduledGhostResult.vehicles,
    enrichedTracking,
    input.dataUpdatedAt,
    input.now,
  );

  const liveBusScheduleDiagnostics =
    input.collectScheduleGhostDiagnostics
      ? buildBlueLiveBusScheduleDiagnostics({
          routeId: input.routeId,
          vehicles: finalVehicles,
          timingResults,
          routeScheduleLoaded: Boolean(input.routeSchedule),
          routeScheduleLoading: input.routeScheduleLoading ?? false,
          activeScheduleCount: schedulePool?.activeJourneys.length ?? 0,
          staticBaseVersion:
            input.staticManifestBaseVersion ?? input.routeSchedule?.baseVersion,
          routeScheduleBaseVersion: input.routeSchedule?.baseVersion,
          liveDetails: input.liveIbusRunningDetails,
        })
      : undefined;

  if (input.collectScheduleGhostDiagnostics) {
    const ibusDataDiagnostics = getIbusDataDiagnostics();
    const ibusFetchDiagnostics = getIbusFetchDiagnostics();
    scheduleTimingDiagnostics = {
      ...(scheduleTimingDiagnostics ?? {
        activeScheduleCount: schedulePool?.activeJourneys.length ?? 0,
        liveMatchingPoolCount: schedulePool?.activeJourneys.length ?? 0,
        candidateMatchCount: timingResults.filter(
          (result) => result.display.candidateMatch,
        ).length,
        trustedTimingCount: timingResults.filter(
          (result) => result.display.trustedTiming,
        ).length,
        rejectedTimingCount: timingResults.filter(
          (result) => !result.display.trustedTiming,
        ).length,
        rejectionReasonCounts: {},
      }),
      liveBaseVersion:
        input.baseVersionSelection?.liveBaseVersion ??
        finalVehicles.find((vehicle) => vehicle.baseVersion)?.baseVersion ??
        input.sampleLivePrediction?.normalizedBaseVersion,
      staticBaseVersion:
        input.staticManifestBaseVersion ?? input.routeSchedule?.baseVersion,
      routeScheduleBaseVersion: input.routeSchedule?.baseVersion,
      activeBaseVersionFromXml: input.activeBaseVersionFromXml,
      selectedBaseVersion: input.baseVersionSelection?.selectedBaseVersion ?? undefined,
      selectedBecause: input.baseVersionSelection?.selectedBecause,
      availableLocalVersionsForRoute:
        input.baseVersionSelection?.availableLocalVersionsForRoute,
      lookupAttemptedKeys: input.baseVersionSelection?.lookupAttemptedKeys,
      baseVersionMatches: liveBaseVersionMatchesStatic(
        input.baseVersionSelection?.liveBaseVersion ??
          finalVehicles.find((vehicle) => vehicle.baseVersion)?.baseVersion ??
          input.sampleLivePrediction?.normalizedBaseVersion,
        input.baseVersionSelection?.selectedBaseVersion ??
          input.routeSchedule?.baseVersion ??
          input.staticManifestBaseVersion ??
          "",
      ),
      sampleLivePrediction: input.sampleLivePrediction,
      blueUnknownLiveCount: countBlueUnknownLiveBuses(finalVehicles),
      unknownReasonCounts: summarizeUnknownReasons(
        liveBusScheduleDiagnostics ?? [],
      ),
      ibusDataSource: ibusDataDiagnostics.ibusDataSource,
      ibusDataBaseUrl: ibusDataDiagnostics.ibusDataBaseUrl,
      manifestLoadedFrom: ibusFetchDiagnostics.manifestLoadedFrom,
      routeScheduleLoadedFrom: ibusFetchDiagnostics.routeScheduleLoadedFrom,
      runningShardLoadedFrom: ibusFetchDiagnostics.runningShardLoadedFrom,
    };
  }

  const metrics = buildServiceHealthMetrics(finalVehicles, {
    dataUpdatedAt: input.dataUpdatedAt,
    now: input.now,
    trackingStates: input.trackingStates,
  });

  const registrationDiagnostics = input.collectRegistrationDiagnostics
    ? buildVehicleRegistrationDiagnostics({
        routeId: input.routeId,
        vehicles: finalVehicles,
        showRegistrationEnabled: input.showRegistrationEnabled ?? true,
        enrichmentLoaded:
          input.enrichmentLoaded ?? Boolean(input.liveIbusRunningDetails),
        liveDetails: input.liveIbusRunningDetails,
      })
    : undefined;

  return {
    vehicles: finalVehicles,
    metrics,
    dashboardSummary: toRouteDashboardSummary(input.routeId, metrics),
    scheduleGhostDiagnostics:
      scheduledGhostResult.diagnostics.length > 0
        ? scheduledGhostResult.diagnostics
        : undefined,
    ghostComparisonSummary: scheduledGhostResult.ghostComparisonSummary,
    ghostRunDiagnostics: scheduledGhostResult.ghostRunDiagnostics,
    scheduleTimingDiagnostics,
    liveBusScheduleDiagnostics,
    registrationDiagnostics,
  };
}
