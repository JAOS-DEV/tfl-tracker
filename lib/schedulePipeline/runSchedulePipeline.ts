import type { LoopLayoutConfig } from "@/lib/constants";
import type { LiveIbusRunningDetail } from "@/lib/ibusLookup";
import type { IbusRouteSchedule } from "@/lib/ibus/scheduleTypes";
import { buildLiveSchedulePool } from "@/lib/schedulePipeline/buildLiveSchedulePool";
import { buildScheduleIndexes } from "@/lib/schedulePipeline/buildScheduleIndexes";
import { enrichLiveVehicles } from "@/lib/schedulePipeline/enrichLiveVehicles";
import { generateScheduleGhosts } from "@/lib/schedulePipeline/generateScheduleGhosts";
import { matchLiveVehiclesToSchedule } from "@/lib/schedulePipeline/matchLiveVehicleToSchedule";
import type {
  ScheduleTimingDiagnostics,
  TimingRejectionReason,
} from "@/lib/schedulePipeline/types";
import type {
  EstimatedVehiclePosition,
  GhostRunDiagnostics,
  NormalizedRoute,
  RouteIntelligenceResult,
} from "@/lib/tfl/types";

export interface RunSchedulePipelineInput {
  routeId: string;
  route: NormalizedRoute;
  routeSchedule: IbusRouteSchedule;
  vehicles: EstimatedVehiclePosition[];
  layout: LoopLayoutConfig;
  now: number;
  dataUpdatedAt: number;
  liveBaseVersion?: string;
  liveIbusRunningDetails?: Map<string, LiveIbusRunningDetail>;
  livePredictionCount?: number;
  showScheduleGhosts: boolean;
  includeLowConfidence: boolean;
  collectDiagnostics: boolean;
  debugRunningNo?: string;
  debugRunningNos?: string[];
  liveEnrichmentComplete?: boolean;
}

export interface RunSchedulePipelineResult {
  vehicles: EstimatedVehiclePosition[];
  pool: ReturnType<typeof buildLiveSchedulePool>;
  timingResults: ReturnType<typeof matchLiveVehiclesToSchedule>["timingResults"];
  timingDiagnostics?: ScheduleTimingDiagnostics;
}

export function runScheduleTimingPipeline(
  input: RunSchedulePipelineInput,
): RunSchedulePipelineResult {
  const pool = buildLiveSchedulePool(input.routeSchedule, input.now);
  const indexes = buildScheduleIndexes(
    pool.activeJourneys,
    pool.baseVersion,
  );

  const enrichedVehicles = enrichLiveVehicles(
    input.vehicles,
    input.liveIbusRunningDetails,
  );

  const { vehicles: timedVehicles, timingResults } = matchLiveVehiclesToSchedule(
    enrichedVehicles,
    pool,
    indexes,
    input.route,
  );

  return {
    vehicles: timedVehicles,
    pool,
    timingResults,
    timingDiagnostics: input.collectDiagnostics
      ? buildTimingDiagnostics(pool, timingResults)
      : undefined,
  };
}

export function runSchedulePipeline(
  input: RunSchedulePipelineInput,
): RunSchedulePipelineResult & {
  scheduleGhostDiagnostics?: string[];
  ghostComparisonSummary?: RouteIntelligenceResult["ghostComparisonSummary"];
  ghostRunDiagnostics?: GhostRunDiagnostics[];
} {
  const timingResult = runScheduleTimingPipeline(input);
  const ghostResult = generateScheduleGhosts({
    routeId: input.routeId,
    route: input.route,
    layout: input.layout,
    vehicles: timingResult.vehicles,
    schedule: input.routeSchedule,
    pool: timingResult.pool,
    now: input.now,
    dataUpdatedAt: input.dataUpdatedAt,
    liveBaseVersion: input.liveBaseVersion,
    livePredictionCount: input.livePredictionCount,
    showScheduleGhosts: input.showScheduleGhosts,
    includeLowConfidence: input.includeLowConfidence,
    collectDiagnostics: input.collectDiagnostics,
    debugRunningNo: input.debugRunningNo,
    debugRunningNos: input.debugRunningNos,
    liveEnrichmentComplete: input.liveEnrichmentComplete,
  });

  return {
    vehicles: ghostResult.vehicles,
    pool: timingResult.pool,
    timingResults: timingResult.timingResults,
    timingDiagnostics: timingResult.timingDiagnostics,
    scheduleGhostDiagnostics:
      ghostResult.diagnostics.length > 0 ? ghostResult.diagnostics : undefined,
    ghostComparisonSummary: ghostResult.ghostComparisonSummary,
    ghostRunDiagnostics: ghostResult.ghostRunDiagnostics,
  };
}

function buildTimingDiagnostics(
  pool: ReturnType<typeof buildLiveSchedulePool>,
  timingResults: ReturnType<typeof matchLiveVehiclesToSchedule>["timingResults"],
): ScheduleTimingDiagnostics {
  const rejectionReasonCounts: Partial<Record<TimingRejectionReason, number>> =
    {};

  for (const result of timingResults) {
    const reason = result.display.rejectionReason;
    if (!reason) {
      continue;
    }
    rejectionReasonCounts[reason] = (rejectionReasonCounts[reason] ?? 0) + 1;
  }

  return {
    activeScheduleCount: pool.activeJourneys.length,
    liveMatchingPoolCount: pool.activeJourneys.length,
    candidateMatchCount: timingResults.filter(
      (result) => result.display.candidateMatch,
    ).length,
    trustedTimingCount: timingResults.filter(
      (result) => result.display.trustedTiming,
    ).length,
    rejectedTimingCount: timingResults.filter(
      (result) => !result.display.trustedTiming,
    ).length,
    rejectionReasonCounts,
  };
}
