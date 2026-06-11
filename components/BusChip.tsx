import { formatLocalTime, formatMinutes } from "@/lib/format";
import type { NormalizedVehiclePrediction } from "@/lib/tfl/types";

interface BusChipProps {
  prediction: NormalizedVehiclePrediction;
}

export function BusChip({ prediction }: BusChipProps): React.ReactElement {
  return (
    <div className="rounded-lg border border-emerald-300/60 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-950 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-950/50 dark:text-emerald-100">
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
