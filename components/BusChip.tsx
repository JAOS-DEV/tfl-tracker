import { formatLocalTime, formatMinutes } from "@/lib/format";
import type { NormalizedVehiclePrediction } from "@/lib/tfl/types";

interface BusChipProps {
  prediction: NormalizedVehiclePrediction;
  muted?: boolean;
}

export function BusChip({
  prediction,
  muted = false,
}: BusChipProps): React.ReactElement {
  return (
    <div
      className={`rounded-lg border px-2.5 py-2 text-xs shadow-sm ${
        muted
          ? "border-zinc-300/60 bg-zinc-100 text-zinc-700 dark:border-zinc-600/40 dark:bg-zinc-800/50 dark:text-zinc-300"
          : "border-emerald-300/60 bg-emerald-50 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-950/50 dark:text-emerald-100"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold">{prediction.routeNumber}</span>
        <span className="font-semibold">
          {formatMinutes(prediction.timeToStation)}
        </span>
      </div>
      <p className="mt-1 truncate">{prediction.destinationName}</p>
      <p className="mt-1 text-[11px] opacity-80">
        ETA {formatLocalTime(prediction.expectedArrival)}
      </p>
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
