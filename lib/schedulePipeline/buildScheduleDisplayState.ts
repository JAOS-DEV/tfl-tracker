import type { LiveScheduleMatchReason } from "@/lib/scheduledGhostBuses";
import type { IbusScheduledStop } from "@/lib/ibus/scheduleTypes";
import {
  buildVehicleScheduleMatch,
  calculateScheduleDeviationMinutes,
  classifyScheduleDeviation,
  gateScheduleStatusForConfidence,
  resolveScheduleMatchConfidence,
  scheduleStatusLabel,
  type ScheduleMatchQuality,
} from "@/lib/scheduleDeviation";
import type { EstimatedVehiclePosition } from "@/lib/tfl/types";
import type {
  CandidateScheduleMatch,
  ScheduleDisplayState,
  TimingRejectionReason,
} from "@/lib/schedulePipeline/types";

const STRONG_MATCH_REASONS = new Set<LiveScheduleMatchReason>([
  "tripId/baseVersion",
  "runningNo/blockNo",
  "same route/runningNo",
]);

const TIMING_MATCH_REASONS = new Set<LiveScheduleMatchReason>([
  "tripId/baseVersion",
  "runningNo/blockNo",
  "same route/runningNo",
  "next-stop/time",
]);

function matchQualityForReason(
  reason: LiveScheduleMatchReason,
): ScheduleMatchQuality {
  if (reason === "tripId/baseVersion") {
    return "exact";
  }
  if (reason === "runningNo/blockNo" || reason === "same route/runningNo") {
    return "strong";
  }
  return "weak";
}

function rejectionForUntrustedMatch(
  reason: LiveScheduleMatchReason | null,
  confidence: ScheduleDisplayState["scheduleMatchConfidence"],
  rawStatus: ScheduleDisplayState["scheduleStatus"],
): TimingRejectionReason | undefined {
  if (!reason) {
    return "no-trusted-match";
  }
  if (!TIMING_MATCH_REASONS.has(reason)) {
    return "weak-fallback";
  }
  if (!STRONG_MATCH_REASONS.has(reason) && confidence !== "high") {
    return "weak-fallback";
  }
  if (confidence === "unknown" || confidence === "low") {
    if (rawStatus === "early") {
      return "deviation-too-early";
    }
    if (rawStatus === "late") {
      return "deviation-too-late-for-match-quality";
    }
    return "no-trusted-match";
  }
  return undefined;
}

export function buildUnknownScheduleDisplayState(
  vehicle: EstimatedVehiclePosition,
  explanation: string,
  rejectionReason: TimingRejectionReason,
): ScheduleDisplayState {
  return {
    candidateMatch: false,
    trustedTiming: false,
    deviationMinutes: null,
    scheduleStatus: "unknown",
    scheduleStatusLabel: "Schedule ?",
    scheduleMatchConfidence: "unknown",
    matchedScheduledTime: null,
    matchedStopName: vehicle.nextStop?.name ?? null,
    scheduleDataAvailable: true,
    scheduleExplanation: explanation,
    rejectionReason,
  };
}

export function buildScheduleDisplayState(
  vehicle: EstimatedVehiclePosition,
  route: Parameters<typeof buildVehicleScheduleMatch>[3],
  match: CandidateScheduleMatch | null,
  scheduledStop: IbusScheduledStop | null,
  scheduledInstantIso: string | null,
): ScheduleDisplayState {
  if (vehicle.ghostStatus === "suspectedGhost") {
    const fallback = buildVehicleScheduleMatch(vehicle, null, 1, route);
    return {
      candidateMatch: false,
      trustedTiming: false,
      deviationMinutes: fallback.deviationMinutes,
      scheduleStatus: fallback.scheduleStatus,
      scheduleStatusLabel: fallback.scheduleStatusLabel,
      scheduleMatchConfidence: fallback.scheduleMatchConfidence,
      matchedScheduledTime: fallback.matchedScheduledTime,
      matchedStopName: fallback.matchedStopName,
      scheduleDataAvailable: fallback.scheduleDataAvailable,
      scheduleExplanation: fallback.scheduleExplanation ?? "Suspected ghost",
      rejectionReason: "ghost-suspected",
    };
  }

  if (!vehicle.matched || !vehicle.nextStop) {
    return buildUnknownScheduleDisplayState(
      vehicle,
      "Schedule match uncertain",
      !vehicle.nextStop ? "missing-next-stop" : "unmatched-position",
    );
  }

  if (!match) {
    return buildUnknownScheduleDisplayState(
      vehicle,
      "No matching active iBus journey for live bus",
      "no-candidate-match",
    );
  }

  if (!scheduledStop || !scheduledInstantIso) {
    return buildUnknownScheduleDisplayState(
      vehicle,
      "Matched journey has no scheduled time for next stop",
      "next-stop-not-in-schedule",
    );
  }

  const deviationMinutes = calculateScheduleDeviationMinutes(
    vehicle.expectedArrival,
    scheduledInstantIso,
  );
  const rawScheduleStatus = classifyScheduleDeviation(deviationMinutes);
  const scheduleMatchConfidence = resolveScheduleMatchConfidence(
    matchQualityForReason(match.reason),
    deviationMinutes,
  );
  const scheduleStatus = gateScheduleStatusForConfidence(
    rawScheduleStatus,
    scheduleMatchConfidence,
  );
  const trustedTiming =
    scheduleStatus !== "unknown" &&
    scheduleMatchConfidence !== "unknown" &&
    scheduleMatchConfidence !== "low";

  return {
    candidateMatch: true,
    trustedTiming,
    deviationMinutes,
    scheduleStatus,
    scheduleStatusLabel: scheduleStatusLabel(scheduleStatus, deviationMinutes),
    scheduleMatchConfidence,
    matchedScheduledTime: scheduledInstantIso,
    matchedStopName: scheduledStop.stopName || vehicle.nextStop.name,
    scheduleDataAvailable: true,
    scheduleExplanation: `Matched iBus journey ${match.journey.tripId} (${match.reason})`,
    matchedJourneyId: match.journey.tripId,
    rejectionReason: trustedTiming
      ? undefined
      : rejectionForUntrustedMatch(
          match.reason,
          scheduleMatchConfidence,
          rawScheduleStatus,
        ),
  };
}
