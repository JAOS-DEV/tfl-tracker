"use client";

import { GhostIcon } from "@/components/GhostIcon";
import { MobileBottomSheet } from "@/components/MobileBottomSheet";
import { formatLastUpdated, formatLocalTime, formatMinutes } from "@/lib/format";
import { ghostStatusLabel } from "@/lib/ghostBusDetection";
import { predictionConfidenceLabel } from "@/lib/predictionTracking";
import { isStopIdLike } from "@/lib/stopDisplayName";
import type {
  EstimatedVehiclePosition,
  PredictionConfidence,
} from "@/lib/tfl/types";

interface BusDetailsModalProps {
  vehicle: EstimatedVehiclePosition | null;
  predictionConfidence?: PredictionConfidence;
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
  onClose,
}: BusDetailsModalProps): React.ReactElement | null {
  if (!vehicle) {
    return null;
  }

  const confidence =
    vehicle.predictionConfidence ?? predictionConfidence ?? "normal";

  const matchedStopDisplay =
    vehicle.matchedStopName &&
    !isStopIdLike(vehicle.matchedStopName)
      ? vehicle.matchedStopName
      : vehicle.nextStop?.name ?? null;

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
          {vehicle.isSuspectedGhost ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              <GhostIcon size={14} />
              Possible ghost
            </span>
          ) : null}
          {vehicle.ghostStatus === "disappeared" ? (
            <span className="inline-block rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Prediction disappeared
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Position is estimated from TfL arrival predictions, not live GPS.
        </p>

        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-zinc-500">Vehicle ID</dt>
            <dd className="font-medium">{vehicle.vehicleId}</dd>
          </div>
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

        {vehicle.isSuspectedGhost || vehicle.ghostStatus !== "normal" ? (
          <section className="mt-4 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
            <h3 className="text-sm font-semibold">Prediction tracking</h3>
            <p className="mt-2 text-sm">{ghostStatusLabel(vehicle.ghostStatus)}</p>
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
            {vehicle.ghostReason ? (
              <p className="mt-2 text-xs text-zinc-500">{vehicle.ghostReason}</p>
            ) : null}
            {vehicle.isSuspectedGhost ? (
              <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                This bus prediction has disappeared from the TfL feed for multiple
                refreshes. It may be a ghost bus, but TfL data can briefly flicker.
              </p>
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
