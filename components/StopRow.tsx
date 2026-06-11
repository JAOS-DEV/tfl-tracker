import { BusChip } from "@/components/BusChip";
import { calculateHeadway } from "@/lib/headway";
import type {
  NormalizedStop,
  NormalizedVehiclePrediction,
  StopDisruption,
} from "@/lib/tfl/types";

interface StopRowProps {
  stop: NormalizedStop;
  predictions: NormalizedVehiclePrediction[];
  isFirst: boolean;
  isLast: boolean;
  stopDisruption?: StopDisruption;
  onSelect: (stop: NormalizedStop) => void;
}

export function StopRow({
  stop,
  predictions,
  isFirst,
  isLast,
  stopDisruption,
  onSelect,
}: StopRowProps): React.ReactElement {
  const headway = calculateHeadway(predictions);

  return (
    <button
      type="button"
      onClick={() => onSelect(stop)}
      className="group grid w-full grid-cols-[28px_1fr] gap-3 rounded-xl px-2 py-3 text-left transition hover:bg-zinc-100 dark:hover:bg-zinc-800/70"
    >
      <div className="relative flex justify-center">
        {!isFirst ? (
          <span className="absolute bottom-1/2 top-0 w-0.5 bg-zinc-300 dark:bg-zinc-600" />
        ) : null}
        {!isLast ? (
          <span className="absolute bottom-0 top-1/2 w-0.5 bg-zinc-300 dark:bg-zinc-600" />
        ) : null}
        <span
          className={`relative z-10 mt-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 ${
            stopDisruption
              ? "border-red-600 bg-red-100 text-[9px] font-bold text-red-700 dark:border-red-400 dark:bg-red-950 dark:text-red-200"
              : stop.isTimingPoint
                ? "border-amber-500 bg-amber-400"
                : "border-zinc-400 bg-white dark:border-zinc-500 dark:bg-zinc-900"
          }`}
        >
          {stopDisruption ? "×" : null}
        </span>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-zinc-900 dark:text-zinc-100">
              {stop.name}
              {stop.stopLetter ? (
                <span className="ml-2 rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                  {stop.stopLetter}
                </span>
              ) : null}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {stop.naptanId}
            </p>
            {stopDisruption ? (
              <p className="mt-1 text-xs font-medium text-red-700 dark:text-red-300">
                Stop closed
              </p>
            ) : null}
          </div>

          <div className="text-right text-xs text-zinc-600 dark:text-zinc-300">
            {headway.nextMinutes !== null ? (
              <p>Next: {headway.nextMinutes} min</p>
            ) : (
              <p className="opacity-60">No buses</p>
            )}
            {headway.gapMinutes !== null ? (
              <p>Gap: {headway.gapMinutes} min</p>
            ) : null}
          </div>
        </div>

        {predictions.length > 0 ? (
          <div className="mt-2 flex flex-col gap-2">
            {predictions.map((prediction) => (
              <BusChip key={prediction.id} prediction={prediction} />
            ))}
          </div>
        ) : null}
      </div>
    </button>
  );
}
