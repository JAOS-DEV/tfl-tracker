import type { IbusScheduledJourney } from "@/lib/ibus/scheduleTypes";
import type {
  EstimatedVehiclePosition,
  ScheduleMatchConfidence,
  ScheduleStatus,
} from "@/lib/tfl/types";
import type { LiveScheduleMatchReason } from "@/lib/scheduledGhostBuses";

export type TimingRejectionReason =
  | "no-active-journey"
  | "no-trusted-match"
  | "no-candidate-match"
  | "next-stop-not-in-schedule"
  | "deviation-too-late-for-match-quality"
  | "deviation-too-early"
  | "weak-fallback"
  | "stale-live-data"
  | "layover-terminus"
  | "duplicate-suppressed"
  | "ghost-suspected"
  | "unmatched-position"
  | "missing-next-stop";

export type LiveBusUnknownReason =
  | "schedule-loading"
  | "no-route-schedule"
  | "no-active-journey"
  | "no-candidate-match"
  | "weak-fallback"
  | "missing-next-stop"
  | "next-stop-not-in-schedule"
  | "deviation-too-early"
  | "deviation-too-late"
  | "missing-running-number"
  | "missing-block-number"
  | "stale-live-data"
  | "layover-terminus"
  | "disruption-diversion-mismatch"
  | "position-unmatched"
  | "static-trip-not-found-live-version-differs"
  | "trusted-schedule"
  | "other";

export interface LiveBusScheduleDiagnostic {
  routeId: string;
  vehicleId: string;
  vehicleRegistration?: string;
  ibusRunningNo?: string;
  ibusBlockNo?: string;
  tripId?: string;
  baseVersion?: string;
  nextStopName?: string;
  nextStopNaptan?: string;
  expectedArrival?: string;
  positionKnown: boolean;
  candidateMatch: boolean;
  candidateMatchMethod: LiveScheduleMatchReason | null;
  trustedTiming: boolean;
  rawDeviationMinutes: number | null;
  finalScheduleStatus: ScheduleStatus;
  finalAdherence: EstimatedVehiclePosition["adherence"];
  unknownReason: LiveBusUnknownReason;
  scheduleExplanation?: string;
  internalRejectionReason?: TimingRejectionReason;
}

export interface CandidateScheduleMatch {
  journey: IbusScheduledJourney;
  reason: LiveScheduleMatchReason;
}

export interface ScheduleDisplayState {
  candidateMatch: boolean;
  trustedTiming: boolean;
  deviationMinutes: number | null;
  scheduleStatus: ScheduleStatus;
  scheduleStatusLabel: string;
  scheduleMatchConfidence: ScheduleMatchConfidence;
  matchedScheduledTime: string | null;
  matchedStopName: string | null;
  scheduleDataAvailable: boolean;
  scheduleExplanation: string;
  matchedJourneyId?: string;
  rejectionReason?: TimingRejectionReason;
}

export interface ScheduleTimingDiagnostics {
  activeScheduleCount: number;
  liveMatchingPoolCount: number;
  candidateMatchCount: number;
  trustedTimingCount: number;
  rejectedTimingCount: number;
  blueUnknownLiveCount?: number;
  ghostCandidateCount?: number;
  visibleGhostCount?: number;
  rejectionReasonCounts: Partial<Record<TimingRejectionReason, number>>;
  unknownReasonCounts?: Partial<Record<LiveBusUnknownReason, number>>;
  liveBaseVersion?: string;
  staticBaseVersion?: string;
  routeScheduleBaseVersion?: string;
  activeBaseVersionFromXml?: string;
  selectedBaseVersion?: string;
  selectedBecause?:
    | "live-version-local-match"
    | "active-version-local-match"
    | "latest-local-fallback"
    | "no-local-version";
  availableLocalVersionsForRoute?: string[];
  lookupAttemptedKeys?: string[];
  baseVersionMatches?: boolean;
  ibusDataSource?: "local" | "remote";
  ibusDataBaseUrl?: string;
  manifestLoadedFrom?: string;
  routeScheduleLoadedFrom?: string;
  runningShardLoadedFrom?: string;
  sampleLivePrediction?: {
    rawTripId?: string;
    rawBaseVersion?: string;
    normalizedTripId?: string;
    normalizedBaseVersion?: string;
    fieldsUsedForBaseVersion: string;
  };
}

export interface IndexedVehicleTimingResult {
  vehicleId: string;
  display: ScheduleDisplayState;
  rawDeviationMinutes: number | null;
  matchReason: LiveScheduleMatchReason | null;
}
