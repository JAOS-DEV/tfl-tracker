import type {
  IndexedVehicleTimingResult,
  LiveBusScheduleDiagnostic,
  LiveBusUnknownReason,
  TimingRejectionReason,
} from "@/lib/schedulePipeline/types";
import type { EstimatedVehiclePosition } from "@/lib/tfl/types";

export interface BuildLiveBusScheduleDiagnosticsInput {
  routeId: string;
  vehicles: EstimatedVehiclePosition[];
  timingResults: IndexedVehicleTimingResult[];
  routeScheduleLoaded: boolean;
  routeScheduleLoading: boolean;
  activeScheduleCount: number;
  staticBaseVersion?: string;
  routeScheduleBaseVersion?: string;
  liveDetails?: Map<string, import("@/lib/ibusLookup").LiveIbusRunningDetail>;
}

function mapInternalRejectionToUnknownReason(
  rejection: TimingRejectionReason | undefined,
): LiveBusUnknownReason {
  switch (rejection) {
    case "no-candidate-match":
    case "no-trusted-match":
      return "no-candidate-match";
    case "no-active-journey":
      return "no-active-journey";
    case "weak-fallback":
      return "weak-fallback";
    case "missing-next-stop":
      return "missing-next-stop";
    case "next-stop-not-in-schedule":
      return "next-stop-not-in-schedule";
    case "deviation-too-early":
      return "deviation-too-early";
    case "deviation-too-late-for-match-quality":
      return "deviation-too-late";
    case "unmatched-position":
      return "position-unmatched";
    case "layover-terminus":
      return "layover-terminus";
    case "stale-live-data":
      return "stale-live-data";
    case "ghost-suspected":
      return "other";
    default:
      return "other";
  }
}

function resolveUnknownReason(input: {
  vehicle: EstimatedVehiclePosition;
  timing?: IndexedVehicleTimingResult;
  routeScheduleLoaded: boolean;
  routeScheduleLoading: boolean;
  activeScheduleCount: number;
  liveDetail?: import("@/lib/ibusLookup").LiveIbusRunningDetail;
  staticBaseVersion?: string;
}): LiveBusUnknownReason {
  if (input.routeScheduleLoading) {
    return "schedule-loading";
  }
  if (!input.routeScheduleLoaded) {
    return "no-route-schedule";
  }
  if (input.vehicle.markerState === "terminus-layover") {
    return "layover-terminus";
  }
  if (!input.vehicle.matched) {
    return "position-unmatched";
  }
  if (!input.vehicle.nextStop) {
    return "missing-next-stop";
  }
  if (input.activeScheduleCount === 0) {
    return "no-active-journey";
  }
  if (
    input.liveDetail?.runningLookupStatus ===
      "static-trip-not-found-live-version-differs" &&
    !input.vehicle.ibusRunningNo &&
    input.timing?.display.candidateMatch !== true
  ) {
    return "static-trip-not-found-live-version-differs";
  }
  if (
    input.liveDetail?.runningLookupStatus === "not-found" &&
    !input.vehicle.ibusRunningNo &&
    !input.vehicle.tripId &&
    input.timing?.display.candidateMatch !== true
  ) {
    return "no-candidate-match";
  }
  if (
    !input.vehicle.ibusRunningNo &&
    !input.vehicle.tripId &&
    input.timing?.display.candidateMatch !== true
  ) {
    return "missing-running-number";
  }
  if (
    input.timing?.display.candidateMatch &&
    input.timing.matchReason === "runningNo/blockNo" &&
    !input.vehicle.ibusBlockNo
  ) {
    return "missing-block-number";
  }
  if (input.timing?.display.trustedTiming) {
    return "trusted-schedule";
  }
  return mapInternalRejectionToUnknownReason(
    input.timing?.display.rejectionReason,
  );
}

function isBlueLiveBus(vehicle: EstimatedVehiclePosition): boolean {
  return (
    !vehicle.isScheduledGhostCandidate &&
    vehicle.markerState !== "terminus-layover" &&
    vehicle.ghostStatus !== "suspectedGhost" &&
    vehicle.adherence === "unknown"
  );
}

export function buildLiveBusScheduleDiagnostic(
  routeId: string,
  vehicle: EstimatedVehiclePosition,
  timing: IndexedVehicleTimingResult | undefined,
  context: Omit<
    BuildLiveBusScheduleDiagnosticsInput,
    "routeId" | "vehicles" | "timingResults"
  >,
): LiveBusScheduleDiagnostic {
  const unknownReason = resolveUnknownReason({
    vehicle,
    timing,
    routeScheduleLoaded: context.routeScheduleLoaded,
    routeScheduleLoading: context.routeScheduleLoading,
    activeScheduleCount: context.activeScheduleCount,
    liveDetail: context.liveDetails?.get(vehicle.vehicleId),
    staticBaseVersion: context.staticBaseVersion,
  });

  return {
    routeId,
    vehicleId: vehicle.vehicleId,
    vehicleRegistration: vehicle.vehicleRegistration,
    ibusRunningNo: vehicle.ibusRunningNo,
    ibusBlockNo: vehicle.ibusBlockNo,
    tripId: vehicle.tripId,
    baseVersion: vehicle.baseVersion,
    nextStopName: vehicle.nextStop?.name,
    nextStopNaptan: vehicle.nextStop?.naptanId,
    expectedArrival: vehicle.expectedArrival,
    positionKnown: vehicle.matched,
    candidateMatch: timing?.display.candidateMatch ?? false,
    candidateMatchMethod: timing?.matchReason ?? null,
    trustedTiming: timing?.display.trustedTiming ?? false,
    rawDeviationMinutes: timing?.rawDeviationMinutes ?? null,
    finalScheduleStatus: vehicle.scheduleStatus,
    finalAdherence: vehicle.adherence,
    unknownReason,
    scheduleExplanation: vehicle.scheduleExplanation,
    internalRejectionReason: timing?.display.rejectionReason,
  };
}

export function buildLiveBusScheduleDiagnostics(
  input: BuildLiveBusScheduleDiagnosticsInput,
): LiveBusScheduleDiagnostic[] {
  const timingByVehicleId = new Map(
    input.timingResults.map((result) => [result.vehicleId, result]),
  );

  return input.vehicles
    .filter((vehicle) => !vehicle.isScheduledGhostCandidate)
    .map((vehicle) =>
      buildLiveBusScheduleDiagnostic(
        input.routeId,
        vehicle,
        timingByVehicleId.get(vehicle.vehicleId),
        input,
      ),
    );
}

export function buildBlueLiveBusScheduleDiagnostics(
  input: BuildLiveBusScheduleDiagnosticsInput,
): LiveBusScheduleDiagnostic[] {
  return buildLiveBusScheduleDiagnostics(input).filter((diagnostic) => {
    const vehicle = input.vehicles.find(
      (entry) => entry.vehicleId === diagnostic.vehicleId,
    );
    return vehicle ? isBlueLiveBus(vehicle) : false;
  });
}

export function countBlueUnknownLiveBuses(
  vehicles: EstimatedVehiclePosition[],
): number {
  return vehicles.filter(isBlueLiveBus).length;
}

export function summarizeUnknownReasons(
  diagnostics: LiveBusScheduleDiagnostic[],
): Partial<Record<LiveBusUnknownReason, number>> {
  return diagnostics.reduce<Partial<Record<LiveBusUnknownReason, number>>>(
    (counts, diagnostic) => {
      counts[diagnostic.unknownReason] =
        (counts[diagnostic.unknownReason] ?? 0) + 1;
      return counts;
    },
    {},
  );
}

export function markerRingMeaning(
  vehicle: EstimatedVehiclePosition,
): "ghost" | "terminus" | "faded" | "onTime" | "early" | "late" | "unknownSchedule" {
  if (vehicle.ghostStatus === "suspectedGhost" || vehicle.isSuspectedGhost) {
    return "ghost";
  }
  if (vehicle.markerState === "terminus-layover") {
    return "terminus";
  }
  if (
    vehicle.ghostStatus === "missingLatest" ||
    vehicle.ghostStatus === "disappeared"
  ) {
    return "faded";
  }
  if (vehicle.adherence === "onTime") {
    return "onTime";
  }
  if (vehicle.adherence === "early") {
    return "early";
  }
  if (vehicle.adherence === "late") {
    return "late";
  }
  return "unknownSchedule";
}
