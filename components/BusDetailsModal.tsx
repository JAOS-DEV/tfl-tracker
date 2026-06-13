"use client";

import { IbusDetailsSection } from "@/components/IbusDetailsSection";
import { MobileBottomSheet } from "@/components/MobileBottomSheet";
import { useIbusVehicleDetails } from "@/hooks/useIbusVehicleDetails";
import { formatLastUpdated, formatLocalTime, formatMinutes } from "@/lib/format";
import {
  formatFleetNumberLabel,
  formatRunningNumberLabel,
  resolveDisplayFleetNumber,
} from "@/lib/vehicleLabels";
import {
  formatGhostDestination,
  getGhostSource,
  getPossibleGhostExplanation,
  isPossibleGhostBus,
  POSSIBLE_GHOST_SHORT_LABEL,
} from "@/lib/ghostDisplay";
import { predictionConfidenceLabel } from "@/lib/predictionTracking";
import { isStopIdLike } from "@/lib/stopDisplayName";
import {
  formatMovementDecision,
  type SmoothMovementDecision,
} from "@/lib/smoothBusMovement";
import type {
  EstimatedVehiclePosition,
  PredictionConfidence,
} from "@/lib/tfl/types";

interface BusDetailsModalProps {
  vehicle: EstimatedVehiclePosition | null;
  predictionConfidence?: PredictionConfidence;
  movementDecision?: SmoothMovementDecision;
  showAdvancedDiagnostics?: boolean;
  onClose: () => void;
}

const confidenceBadgeClasses = {
  normal:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  stale:
    "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  missing:
    "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  disappeared:
    "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  reappeared:
    "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
} as const;

const scheduleToneClasses = {
  early:
    "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  onTime:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  late: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  unknown: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
} as const;

function scheduleStatusDisplay(
  status: EstimatedVehiclePosition["scheduleStatus"],
): string {
  switch (status) {
    case "early":
      return "Estimated early";
    case "late":
      return "Estimated late";
    case "onTime":
      return "Estimated on time";
    default:
      return "Schedule unknown";
  }
}

function headerStatusChip(
  vehicle: EstimatedVehiclePosition,
  confidence: PredictionConfidence,
  isGhost: boolean,
): string {
  if (isGhost) {
    return POSSIBLE_GHOST_SHORT_LABEL;
  }
  if (vehicle.markerState === "terminus-layover") {
    return vehicle.terminusLayoverLabel ?? "At terminus";
  }
  if (confidence === "stale") {
    return "Stale";
  }
  if (confidence === "missing" || vehicle.ghostStatus === "missingLatest") {
    return "Missing";
  }
  if (vehicle.scheduleStatus === "early") {
    return "Early";
  }
  if (vehicle.scheduleStatus === "late") {
    return "Late";
  }
  if (vehicle.scheduleStatus === "onTime") {
    return "On time";
  }
  return predictionConfidenceLabel(confidence);
}

export function BusDetailsModal({
  vehicle,
  predictionConfidence = "normal",
  movementDecision,
  showAdvancedDiagnostics = false,
  onClose,
}: BusDetailsModalProps): React.ReactElement | null {
  const shouldFetchDetails =
    Boolean(vehicle) &&
    vehicle?.ghostStatus !== "disappeared" &&
    !vehicle?.isSuspectedGhost &&
    !vehicle?.isScheduledGhostCandidate;

  const ibusDetails = useIbusVehicleDetails(
    vehicle
      ? {
          vehicleId: vehicle.vehicleId,
          tripId: vehicle.tripId,
          baseVersion: vehicle.baseVersion,
          lineName: vehicle.routeNumber,
          expectedArrival: vehicle.expectedArrival,
          naptanId: vehicle.nextPrediction.naptanId,
          destinationName: vehicle.destinationName,
        }
      : undefined,
    shouldFetchDetails,
  );

  if (!vehicle) {
    return null;
  }

  const confidence =
    vehicle.predictionConfidence ?? predictionConfidence ?? "normal";
  const isGhost = isPossibleGhostBus(vehicle);
  const ghostExplanation = getPossibleGhostExplanation(vehicle);
  const ghostSource = getGhostSource(vehicle);
  const isScheduleGhost = vehicle.isScheduledGhostCandidate === true;
  const matchedStopDisplay =
    vehicle.matchedStopName &&
    !isStopIdLike(vehicle.matchedStopName)
      ? vehicle.matchedStopName
      : vehicle.nextStop?.name ?? null;

  const headerRegistration = vehicle.vehicleRegistration ?? null;
  const headerFleet =
    ibusDetails.displayFleetNo ??
    vehicle.ibusFleetNo ??
    resolveDisplayFleetNumber(vehicle) ??
    null;
  const headerRunning =
    vehicle.ibusRunningNo ??
    ibusDetails.runningNo ??
    vehicle.scheduledGhostRunningNo ??
    null;

  const identityParts = [
    headerRegistration ? `Registration: ${headerRegistration}` : null,
    headerFleet ? formatFleetNumberLabel(headerFleet) : null,
    headerRunning ? formatRunningNumberLabel(headerRunning) : null,
  ].filter(Boolean);

  return (
    <MobileBottomSheet
      title={`Bus ${vehicle.routeNumber}`}
      titleId="bus-details-title"
      onClose={onClose}
    >
      <div className="text-zinc-900 dark:text-zinc-100">
        <section className="space-y-2">
          <p className="text-sm font-medium">
            {vehicle.routeNumber} · {vehicle.destinationName}
          </p>
          <div className="flex flex-wrap gap-2">
            <span
              className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                isGhost
                  ? "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-100"
                  : vehicle.markerState === "terminus-layover"
                    ? "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                    : confidenceBadgeClasses[confidence]
              }`}
            >
              {headerStatusChip(vehicle, confidence, isGhost)}
            </span>
            {!isGhost && vehicle.scheduleStatus !== "unknown" ? (
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${scheduleToneClasses[vehicle.scheduleStatus]}`}
              >
                {scheduleStatusDisplay(vehicle.scheduleStatus)}
              </span>
            ) : null}
          </div>
          {identityParts.length > 0 ? (
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              {identityParts.join(" · ")}
            </p>
          ) : null}
          {!isGhost && vehicle.markerState === "terminus-layover" ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {vehicle.terminusLayoverLabel ??
                "At terminus / waiting to start return journey"}
            </p>
          ) : null}
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Position is estimated from TfL arrival predictions, not live GPS.
          </p>
        </section>

        {isGhost && ghostExplanation ? (
          <section className="mt-4 rounded-xl border border-violet-300 bg-violet-50 p-3 dark:border-violet-800 dark:bg-violet-950/40">
            <h3 className="text-sm font-semibold text-violet-900 dark:text-violet-100">
              {ghostExplanation.title}
            </h3>
            <p className="mt-2 text-sm text-violet-900 dark:text-violet-100">
              {ghostExplanation.summary}
            </p>
            <dl className="mt-3 space-y-2 text-sm">
              {isScheduleGhost ? (
                <>
                  <div>
                    <dt className="text-violet-700 dark:text-violet-300">Expected near</dt>
                    <dd className="font-medium">
                      {vehicle.matchedStopName ?? "Unknown stop"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-violet-700 dark:text-violet-300">Scheduled time</dt>
                    <dd className="font-medium">
                      {vehicle.matchedScheduledTime
                        ? formatLocalTime(vehicle.matchedScheduledTime)
                        : "Unknown"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-violet-700 dark:text-violet-300">Destination</dt>
                    <dd className="font-medium">
                      {formatGhostDestination(vehicle.destinationName)}
                    </dd>
                  </div>
                </>
              ) : (
                <>
                  {matchedStopDisplay ? (
                    <div>
                      <dt className="text-violet-700 dark:text-violet-300">Last seen stop</dt>
                      <dd className="font-medium">{matchedStopDisplay}</dd>
                    </div>
                  ) : null}
                  {vehicle.lastSeenAt ? (
                    <div>
                      <dt className="text-violet-700 dark:text-violet-300">Last seen time</dt>
                      <dd className="font-medium">
                        {formatLastUpdated(new Date(vehicle.lastSeenAt))}
                      </dd>
                    </div>
                  ) : null}
                </>
              )}
              <div>
                <dt className="text-violet-700 dark:text-violet-300">Source</dt>
                <dd className="font-medium">{ghostExplanation.sourceLabel}</dd>
              </div>
              {showAdvancedDiagnostics ? (
                <>
                  <div>
                    <dt className="text-violet-700 dark:text-violet-300">Ghost source</dt>
                    <dd className="font-medium capitalize">{ghostSource}</dd>
                  </div>
                  {vehicle.ghostReason ? (
                    <div>
                      <dt className="text-violet-700 dark:text-violet-300">Ghost reason</dt>
                      <dd className="font-medium">{vehicle.ghostReason}</dd>
                    </div>
                  ) : null}
                  {vehicle.scheduledGhostConfidence ? (
                    <div>
                      <dt className="text-violet-700 dark:text-violet-300">Confidence</dt>
                      <dd className="font-medium capitalize">
                        {vehicle.scheduledGhostConfidence}
                      </dd>
                    </div>
                  ) : null}
                </>
              ) : null}
            </dl>
          </section>
        ) : null}

        <section className="mt-4 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
          <h3 className="text-sm font-semibold">Next live prediction</h3>
          <dl className="mt-3 space-y-2 text-sm">
            {vehicle.matched ? (
              <div>
                <dt className="text-zinc-500">Estimated position</dt>
                <dd className="font-medium">
                  Stop {vehicle.stopIndex + 1}
                  {vehicle.nextStop ? ` · ${vehicle.nextStop.name}` : ""}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-zinc-500">Next predicted stop</dt>
              <dd className="font-medium">
                {vehicle.nextStop?.name ?? "Unable to match to route stop"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Due in</dt>
              <dd className="font-medium">{formatMinutes(vehicle.timeToStation)}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Expected arrival</dt>
              <dd className="font-medium">
                {formatLocalTime(vehicle.expectedArrival)}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Destination</dt>
              <dd className="font-medium">{vehicle.destinationName}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Direction</dt>
              <dd className="font-medium capitalize">{vehicle.direction}</dd>
            </div>
            {vehicle.currentLocation ? (
              <div>
                <dt className="text-zinc-500">Current location</dt>
                <dd className="font-medium">{vehicle.currentLocation}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className="mt-4 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
          <h3 className="text-sm font-semibold">Schedule match</h3>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            This compares the live bus position with the iBus schedule estimate.
            It is approximate and may be affected by missing or delayed live
            data.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${scheduleToneClasses[vehicle.scheduleStatus]}`}
            >
              {scheduleStatusDisplay(vehicle.scheduleStatus)}
            </span>
          </div>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-zinc-500">Variance</dt>
              <dd className="font-medium">
                {vehicle.scheduleDeviationMinutes !== null
                  ? vehicle.scheduleStatusLabel
                  : "Schedule match uncertain"}
              </dd>
            </div>
            {matchedStopDisplay ? (
              <div>
                <dt className="text-zinc-500">Scheduled stop</dt>
                <dd className="font-medium">{matchedStopDisplay}</dd>
              </div>
            ) : null}
            {vehicle.matchedScheduledTime ? (
              <div>
                <dt className="text-zinc-500">Scheduled time</dt>
                <dd className="font-medium">
                  {formatLocalTime(vehicle.matchedScheduledTime)}
                </dd>
              </div>
            ) : null}
            {showAdvancedDiagnostics && vehicle.scheduleMatchConfidence !== "unknown" ? (
              <div>
                <dt className="text-zinc-500">Matched by</dt>
                <dd className="font-medium capitalize">
                  {vehicle.scheduleMatchConfidence}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>

        <IbusDetailsSection
          details={ibusDetails}
          hideRegistration={Boolean(headerRegistration)}
          hideFleetNumber={Boolean(headerFleet)}
          hideRunningNumber={Boolean(headerRunning)}
          showBaseVersion={showAdvancedDiagnostics}
        />

        {!isGhost &&
        (vehicle.ghostStatus === "missingLatest" ||
          vehicle.ghostStatus === "reappeared" ||
          vehicle.ghostStatus === "stale") ? (
          <section className="mt-4 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
            <h3 className="text-sm font-semibold">Prediction tracking</h3>
            <p className="mt-2 text-sm">
              {vehicle.ghostStatus === "missingLatest"
                ? "Missing from latest TfL feed"
                : vehicle.ghostStatus === "reappeared"
                  ? "Reappeared"
                  : "TfL data may be stale"}
            </p>
            {vehicle.lastSeenAt ? (
              <p className="mt-1 text-sm text-zinc-500">
                Last seen {formatLastUpdated(new Date(vehicle.lastSeenAt))}
              </p>
            ) : null}
            {showAdvancedDiagnostics && vehicle.ghostReason ? (
              <p className="mt-2 text-xs text-zinc-500">{vehicle.ghostReason}</p>
            ) : null}
          </section>
        ) : null}

        {!vehicle.matched ? (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
            Unable to match this vehicle to a route stop.
          </p>
        ) : null}

        {showAdvancedDiagnostics && movementDecision ? (
          <section className="mt-4 rounded-xl border border-dashed border-zinc-300 p-3 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              Loop movement debug
            </h3>
            <dl className="mt-2 space-y-1">
              <div className="flex gap-2">
                <dt className="font-medium">Movement</dt>
                <dd className="capitalize">{movementDecision.mode}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium">Reason</dt>
                <dd>{movementDecision.reason}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium">Summary</dt>
                <dd>{formatMovementDecision(movementDecision)}</dd>
              </div>
            </dl>
          </section>
        ) : null}
      </div>
    </MobileBottomSheet>
  );
}
