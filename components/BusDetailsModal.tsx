"use client";

import { MobileBottomSheet } from "@/components/MobileBottomSheet";
import { formatLocalTime, formatMinutes } from "@/lib/format";
import { predictionConfidenceLabel } from "@/lib/predictionTracking";
import { adherenceLabel } from "@/lib/scheduleAdherence";
import type {
  EstimatedVehiclePosition,
  PredictionConfidence,
} from "@/lib/tfl/types";

interface BusDetailsModalProps {
  vehicle: EstimatedVehiclePosition | null;
  predictionConfidence?: PredictionConfidence;
  onClose: () => void;
}

const adherenceBadgeClasses = {
  onTime:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  late: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  early:
    "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
} as const;

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

  return (
    <MobileBottomSheet
      title={`Bus ${vehicle.routeNumber}`}
      titleId="bus-details-title"
      onClose={onClose}
    >
      <div className="text-zinc-900 dark:text-zinc-100">
        <div className="flex flex-wrap gap-2">
          <span
            className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${adherenceBadgeClasses[vehicle.adherence]}`}
          >
            {adherenceLabel(vehicle.adherence)}
          </span>
          <span
            className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${confidenceBadgeClasses[confidence]}`}
          >
            {predictionConfidenceLabel(confidence)}
          </span>
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

        {!vehicle.matched ? (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
            Unable to match this vehicle to a route stop.
          </p>
        ) : null}
      </div>
    </MobileBottomSheet>
  );
}
