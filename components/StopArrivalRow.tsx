import { StatusPill } from "@/components/StatusPill";
import { formatDueLabel, formatLocalTime } from "@/lib/format";
import { ghostStatusLabel } from "@/lib/ghostBusDetection";
import type { EstimatedVehiclePosition, NormalizedVehiclePrediction } from "@/lib/tfl/types";

interface StopArrivalRowProps {
  prediction: NormalizedVehiclePrediction;
  vehicle?: EstimatedVehiclePosition;
  highlighted?: boolean;
  onAddRoute?: (routeId: string, routeName: string) => void;
}

function scheduleVariant(
  status: EstimatedVehiclePosition["scheduleStatus"],
): "early" | "onTime" | "late" | "unknown" {
  if (status === "early") {
    return "early";
  }
  if (status === "late") {
    return "late";
  }
  if (status === "onTime") {
    return "onTime";
  }
  return "unknown";
}

export function StopArrivalRow({
  prediction,
  vehicle,
  highlighted = false,
  onAddRoute,
}: StopArrivalRowProps): React.ReactElement {
  const showSchedule =
    vehicle &&
    !vehicle.isSuspectedGhost &&
    vehicle.scheduleMatchConfidence !== "unknown" &&
    vehicle.scheduleMatchConfidence !== "low" &&
    vehicle.scheduleStatusLabel !== "Schedule ?";

  return (
    <div
      className={`rounded-xl border px-3 py-2.5 ${
        highlighted
          ? "border-sky-300 bg-sky-50 dark:border-sky-700 dark:bg-sky-950/30"
          : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
              {prediction.routeNumber}
            </span>
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {formatDueLabel(prediction.timeToStation)}
            </span>
            {showSchedule && vehicle ? (
              <StatusPill
                label={vehicle.scheduleStatusLabel}
                variant={scheduleVariant(vehicle.scheduleStatus)}
                size="sm"
              />
            ) : null}
            {vehicle?.isSuspectedGhost ? (
              <StatusPill label="Ghost" variant="ghost" size="sm" />
            ) : null}
            {vehicle?.ghostStatus === "disappeared" ? (
              <StatusPill label="Disappeared" variant="warning" size="sm" />
            ) : null}
          </div>
          <p className="mt-1 truncate text-sm text-zinc-700 dark:text-zinc-300">
            To {prediction.destinationName}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Expected {formatLocalTime(prediction.expectedArrival)}
          </p>
      {prediction.vehicleRegistration ||
      prediction.vehicleFleetReference ||
      vehicle?.vehicleRegistration ||
      vehicle?.vehicleFleetReference ? (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {prediction.vehicleRegistration ??
            vehicle?.vehicleRegistration ??
            prediction.vehicleFleetReference ??
            vehicle?.vehicleFleetReference}
        </p>
      ) : null}
          {vehicle?.isSuspectedGhost ? (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {ghostStatusLabel(vehicle.ghostStatus)}
            </p>
          ) : null}
        </div>
        {onAddRoute ? (
          <button
            type="button"
            onClick={() =>
              onAddRoute(prediction.routeId, prediction.routeNumber)
            }
            className="min-h-11 shrink-0 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Add route
          </button>
        ) : null}
      </div>
    </div>
  );
}
