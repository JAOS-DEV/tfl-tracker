import { calculateRouteSummary } from "@/lib/headway";
import { formatLocalTime } from "@/lib/format";
import type { NormalizedVehiclePrediction } from "@/lib/tfl/types";

interface RouteSummaryProps {
  predictions: NormalizedVehiclePrediction[];
}

export function RouteSummary({
  predictions,
}: RouteSummaryProps): React.ReactElement {
  const summary = calculateRouteSummary(predictions);

  return (
    <div className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-2">
      <div>
        <p className="text-xs uppercase tracking-wide text-zinc-500">Live vehicles</p>
        <p className="mt-1 text-lg font-semibold">{summary.liveVehicleCount}</p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-zinc-500">Average gap</p>
        <p className="mt-1 text-lg font-semibold">
          {summary.averageGapMinutes !== null
            ? `${summary.averageGapMinutes} min`
            : "—"}
        </p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-zinc-500">Earliest arrival</p>
        <p className="mt-1 font-medium">
          {summary.earliestArrival
            ? formatLocalTime(summary.earliestArrival)
            : "—"}
        </p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-zinc-500">Latest arrival</p>
        <p className="mt-1 font-medium">
          {summary.latestArrival
            ? formatLocalTime(summary.latestArrival)
            : "—"}
        </p>
      </div>
    </div>
  );
}
