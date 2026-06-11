import { RouteSummaryBadges } from "@/components/RouteSummaryBadges";
import { calculateRouteSummary } from "@/lib/headway";
import type { NormalizedVehiclePrediction } from "@/lib/tfl/types";

interface RouteSummaryProps {
  predictions: NormalizedVehiclePrediction[];
  compact?: boolean;
}

export function RouteSummary({
  predictions,
  compact = false,
}: RouteSummaryProps): React.ReactElement {
  const summary = calculateRouteSummary(predictions);

  return (
    <div
      className={`space-y-3 text-sm ${
        compact
          ? "rounded-xl bg-zinc-100/80 p-3 dark:bg-zinc-800/50"
          : "rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
      }`}
    >
      <RouteSummaryBadges predictions={predictions} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Live vehicles
          </p>
          <p className="mt-1 text-lg font-semibold">{summary.liveVehicleCount}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Average gap
          </p>
          <p className="mt-1 text-lg font-semibold">
            {summary.averageGapMinutes !== null
              ? `${summary.averageGapMinutes} min`
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Largest gap
          </p>
          <p className="mt-1 text-lg font-semibold">
            {summary.largestGapMinutes !== null
              ? `${summary.largestGapMinutes} min`
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Busiest stop
          </p>
          <p className="mt-1 font-medium">
            {summary.busiestStopName
              ? `${summary.busiestStopName} (${summary.busiestStopCount})`
              : "—"}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Stop with the most live arrival predictions right now.
          </p>
        </div>
      </div>
    </div>
  );
}
