import type { LoopLayoutConfig } from "@/lib/constants";
import {
  appendScheduledGhostVehicles,
  type AppendScheduledGhostResult,
} from "@/lib/scheduledGhostVehicles";
import type { LiveSchedulePool } from "@/lib/schedulePipeline/buildLiveSchedulePool";
import type { IbusRouteSchedule } from "@/lib/ibus/scheduleTypes";
import type { EstimatedVehiclePosition, NormalizedRoute } from "@/lib/tfl/types";

export interface GenerateScheduleGhostsInput {
  routeId: string;
  route: NormalizedRoute;
  layout: LoopLayoutConfig;
  vehicles: EstimatedVehiclePosition[];
  schedule: IbusRouteSchedule;
  pool: LiveSchedulePool;
  now: number;
  dataUpdatedAt: number;
  liveBaseVersion?: string;
  livePredictionCount?: number;
  showScheduleGhosts: boolean;
  includeLowConfidence: boolean;
  collectDiagnostics: boolean;
  debugRunningNo?: string;
  debugRunningNos?: string[];
  liveEnrichmentComplete?: boolean;
}

export function generateScheduleGhosts(
  input: GenerateScheduleGhostsInput,
): AppendScheduledGhostResult {
  return appendScheduledGhostVehicles({
    routeId: input.routeId,
    route: input.route,
    layout: input.layout,
    vehicles: input.vehicles,
    schedule: input.schedule,
    activeJourneys: input.pool.activeJourneys,
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
}
