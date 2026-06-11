"use client";

import { formatLocalTime, formatMinutes } from "@/lib/format";
import { adherenceLabel } from "@/lib/scheduleAdherence";
import type { EstimatedVehiclePosition } from "@/lib/tfl/types";

interface BusDetailsModalProps {
  vehicle: EstimatedVehiclePosition | null;
  onClose: () => void;
}

const adherenceBadgeClasses = {
  onTime:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  late: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  early:
    "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
} as const;

export function BusDetailsModal({
  vehicle,
  onClose,
}: BusDetailsModalProps): React.ReactElement | null {
  if (!vehicle) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bus-details-title"
        className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-4 text-zinc-900 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="bus-details-title" className="text-lg font-semibold">
              Bus {vehicle.routeNumber}
            </h2>
            <span
              className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-medium ${adherenceBadgeClasses[vehicle.adherence]}`}
            >
              {adherenceLabel(vehicle.adherence)}
            </span>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Estimated from TfL live arrival predictions
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Close
          </button>
        </div>

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
        </dl>

        {!vehicle.matched ? (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
            Unable to match this vehicle to a route stop.
          </p>
        ) : null}
      </div>
    </div>
  );
}
