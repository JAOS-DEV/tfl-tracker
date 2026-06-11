import { formatLocalTime, formatMinutes } from "@/lib/format";
import { ghostStatusLabel } from "@/lib/ghostBusDetection";
import type { EstimatedVehiclePosition, NormalizedVehiclePrediction } from "@/lib/tfl/types";

interface BusChipProps {
  prediction: NormalizedVehiclePrediction;
  vehicle?: EstimatedVehiclePosition;
  muted?: boolean;
}

export function BusChip({
  prediction,
  vehicle,
  muted = false,
}: BusChipProps): React.ReactElement {
  const showSchedule =
    vehicle &&
    !vehicle.isSuspectedGhost &&
    (vehicle.scheduleMatchConfidence === "high" ||
      vehicle.scheduleMatchConfidence === "medium");

  return (
    <div
      className={`rounded-lg border px-2.5 py-2 text-xs shadow-sm ${
        muted
          ? "border-zinc-300/60 bg-zinc-100 text-zinc-700 dark:border-zinc-600/40 dark:bg-zinc-800/50 dark:text-zinc-300"
          : vehicle?.isSuspectedGhost
            ? "border-zinc-400/60 bg-zinc-100 text-zinc-700 dark:border-zinc-600/40 dark:bg-zinc-900/60 dark:text-zinc-300"
          : "border-emerald-300/60 bg-emerald-50 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-950/50 dark:text-emerald-100"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold">{prediction.routeNumber}</span>
        <div className="flex items-center gap-1.5">
          {showSchedule ? (
            <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold dark:bg-black/20">
              {vehicle.scheduleStatusLabel}
            </span>
          ) : null}
          <span className="font-semibold">
            {formatMinutes(prediction.timeToStation)}
          </span>
        </div>
      </div>
      <p className="mt-1 truncate">{prediction.destinationName}</p>
      <p className="mt-1 text-[11px] opacity-80">
        ETA {formatLocalTime(prediction.expectedArrival)}
      </p>
      {vehicle?.isSuspectedGhost ? (
        <p className="mt-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
          {ghostStatusLabel(vehicle.ghostStatus)}
        </p>
      ) : null}
      {vehicle?.ghostStatus === "disappeared" ? (
        <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
          Prediction disappeared
        </p>
      ) : null}
      {prediction.vehicleId ? (
        <p className="mt-1 text-[11px] opacity-70">
          Vehicle {prediction.vehicleId}
        </p>
      ) : null}
      {prediction.currentLocation ? (
        <p className="mt-1 text-[11px] opacity-70">
          Near {prediction.currentLocation}
        </p>
      ) : null}
    </div>
  );
}
