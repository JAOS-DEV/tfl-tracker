"use client";

import { GhostIcon } from "@/components/GhostIcon";
import { IbusDetailsSection } from "@/components/IbusDetailsSection";
import { MobileBottomSheet } from "@/components/MobileBottomSheet";
import { useIbusVehicleDetails } from "@/hooks/useIbusVehicleDetails";
import { formatLastUpdated, formatLocalTime, formatMinutes } from "@/lib/format";
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

function scheduleStatusDisplay(status: EstimatedVehiclePosition["scheduleStatus"]): string {
  switch (status) {
    case "early":
      return "Estimated early";
    case "late":
      return "Estimated late";
    case "onTime":
      return "Estimated on time";
    default:
      return "Unknown";
  }
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

  const headerFleetLabel =
    vehicle.vehicleRegistration && ibusDetails.displayFleetNo
      ? `${vehicle.vehicleRegistration} · ${ibusDetails.displayFleetNo}`
      : null;

  return (
    <MobileBottomSheet
      title={`Bus ${vehicle.routeNumber}`}
      titleId="bus-details-title"
      onClose={onClose}
    >
      <div className="text-zinc-900 dark:text-zinc-100">
        <div className="flex flex-wrap gap-2">
          <span
            className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${confidenceBadgeClasses[confidence]}`}
          >
            {predictionConfidenceLabel(confidence)}
          </span>
          {isGhost ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-900 dark:bg-violet-950 dark:text-violet-100">
              <GhostIcon size={16} />
              {POSSIBLE_GHOST_SHORT_LABEL}
            </span>
          ) : null}
          {!isGhost && vehicle.ghostStatus === "disappeared" ? (
            <span className="inline-block rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Prediction disappeared
            </span>
          ) : null}
        </div>
        {headerFleetLabel ? (
          <p className="mt-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {headerFleetLabel}
          </p>
        ) : null}
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Position is estimated from TfL arrival predictions, not live GPS.
        </p>

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
                    <dt className="text-violet-700 dark:text-violet-300">Running number</dt>
                    <dd className="font-medium">
                      {vehicle.scheduledGhostRunningNo ?? "Unknown"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-violet-700 dark:text-violet-300">Block</dt>
                    <dd className="font-medium">
                      {vehicle.scheduledGhostBlockNo ?? "Unknown"}
                    </dd>
                  </div>
                  {vehicle.scheduledGhostGarageNo ? (
                    <div>
                      <dt className="text-violet-700 dark:text-violet-300">Garage no</dt>
                      <dd className="font-medium">{vehicle.scheduledGhostGarageNo}</dd>
                    </div>
                  ) : null}
                  {vehicle.scheduledGhostOperatorCode ? (
                    <div>
                      <dt className="text-violet-700 dark:text-violet-300">Operator</dt>
                      <dd className="font-medium">{vehicle.scheduledGhostOperatorCode}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-violet-700 dark:text-violet-300">Destination</dt>
                    <dd className="font-medium">
                      {formatGhostDestination(vehicle.destinationName)}
                    </dd>
                  </div>
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
                  {showAdvancedDiagnostics && vehicle.scheduledGhostConfidence ? (
                    <div>
                      <dt className="text-violet-700 dark:text-violet-300">Confidence</dt>
                      <dd className="font-medium capitalize">
                        {vehicle.scheduledGhostConfidence}
                      </dd>
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  {vehicle.vehicleRegistration ? (
                    <div>
                      <dt className="text-violet-700 dark:text-violet-300">Registration</dt>
                      <dd className="font-medium">{vehicle.vehicleRegistration}</dd>
                    </div>
                  ) : null}
                  {vehicle.vehicleFleetReference ? (
                    <div>
                      <dt className="text-violet-700 dark:text-violet-300">Fleet number</dt>
                      <dd className="font-medium">{vehicle.vehicleFleetReference}</dd>
                    </div>
                  ) : null}
                  {vehicle.scheduledGhostRunningNo ? (
                    <div>
                      <dt className="text-violet-700 dark:text-violet-300">Running number</dt>
                      <dd className="font-medium">{vehicle.scheduledGhostRunningNo}</dd>
                    </div>
                  ) : null}
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
                  <div>
                    <dt className="text-violet-700 dark:text-violet-300">Route / direction</dt>
                    <dd className="font-medium capitalize">
                      {vehicle.routeNumber} · {vehicle.direction}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-violet-700 dark:text-violet-300">Destination</dt>
                    <dd className="font-medium">
                      {formatGhostDestination(vehicle.destinationName)}
                    </dd>
                  </div>
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
                </>
              ) : null}
            </dl>
          </section>
        ) : null}

        {movementDecision ? (
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

        <dl className="mt-4 space-y-3 text-sm">
          {vehicle.vehicleRegistration ? (
            <div>
              <dt className="text-zinc-500">Registration</dt>
              <dd className="font-medium">{vehicle.vehicleRegistration}</dd>
            </div>
          ) : (
            <div>
              <dt className="text-zinc-500">Vehicle reference</dt>
              <dd className="font-medium">{vehicle.vehicleId}</dd>
            </div>
          )}
          <div>
            <dt className="text-zinc-500">Direction</dt>
            <dd className="font-medium capitalize">{vehicle.direction}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Destination</dt>
            <dd className="font-medium">{vehicle.destinationName}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Next predicted stop</dt>
            <dd className="font-medium">
              {vehicle.nextStop?.name ?? "Unable to match to route stop"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Due in</dt>
            <dd className="font-medium">
              {formatMinutes(vehicle.timeToStation)}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Expected arrival</dt>
            <dd className="font-medium">
              {formatLocalTime(vehicle.expectedArrival)}
            </dd>
          </div>
          {vehicle.currentLocation ? (
            <div>
              <dt className="text-zinc-500">Current location</dt>
              <dd className="font-medium">{vehicle.currentLocation}</dd>
            </div>
          ) : null}
          {vehicle.matched ? (
            <div>
              <dt className="text-zinc-500">Estimated route position</dt>
              <dd className="font-medium">
                Stop {vehicle.stopIndex + 1}
                {vehicle.nextStop ? ` · ${vehicle.nextStop.name}` : ""}
              </dd>
            </div>
          ) : null}
        </dl>

        <IbusDetailsSection
          registration={vehicle.vehicleRegistration}
          vehicleReference={vehicle.vehicleFleetReference ?? vehicle.vehicleId}
          details={ibusDetails}
        />

        <section className="mt-5 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
          <h3 className="text-sm font-semibold">Estimated schedule position</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${scheduleToneClasses[vehicle.scheduleStatus]}`}
            >
              {scheduleStatusDisplay(vehicle.scheduleStatus)}
            </span>
            {vehicle.scheduleMatchConfidence !== "unknown" ? (
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                Confidence: {vehicle.scheduleMatchConfidence}
              </span>
            ) : null}
          </div>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-zinc-500">Difference</dt>
              <dd className="font-medium">
                {vehicle.scheduleDeviationMinutes !== null
                  ? vehicle.scheduleStatusLabel
                  : "Schedule match uncertain"}
              </dd>
            </div>
            {matchedStopDisplay ? (
              <div>
                <dt className="text-zinc-500">Matched stop</dt>
                <dd className="font-medium">{matchedStopDisplay}</dd>
              </div>
            ) : null}
            {vehicle.matchedScheduledTime ? (
              <div>
                <dt className="text-zinc-500">Matched scheduled time</dt>
                <dd className="font-medium">
                  {formatLocalTime(vehicle.matchedScheduledTime)}
                </dd>
              </div>
            ) : null}
          </dl>
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            This compares TfL live prediction data with timetable data. It is an
            estimate and may not match official operational running data.
          </p>
        </section>

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
            {vehicle.missedRefreshCount > 0 ? (
              <p className="mt-1 text-sm text-zinc-500">
                Missed {vehicle.missedRefreshCount} refresh
                {vehicle.missedRefreshCount === 1 ? "" : "es"}
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
      </div>
    </MobileBottomSheet>
  );
}
