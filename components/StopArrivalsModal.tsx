"use client";

import { BusChip } from "@/components/BusChip";
import { ErrorState } from "@/components/ErrorState";
import { useStopArrivals } from "@/hooks/useStopArrivals";
import { formatLastUpdated } from "@/lib/format";
import type { NormalizedStop } from "@/lib/tfl/types";

interface StopArrivalsModalProps {
  stop: NormalizedStop | null;
  routeId: string;
  onClose: () => void;
}

export function StopArrivalsModal({
  stop,
  routeId,
  onClose,
}: StopArrivalsModalProps): React.ReactElement | null {
  const stopPointId = stop?.naptanId ?? null;
  const { data, isLoading, isError, error, refetch, dataUpdatedAt } =
    useStopArrivals(stopPointId);

  if (!stop) {
    return null;
  }

  const routePredictions =
    data?.predictions.filter(
      (prediction) =>
        prediction.routeId === routeId ||
        prediction.routeNumber === routeId,
    ) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="stop-arrivals-title"
        className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
      >
        <div className="flex items-start justify-between border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
          <div>
            <h2
              id="stop-arrivals-title"
              className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
            >
              {stop.name}
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {stop.naptanId}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Close
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-4 py-4">
          {isLoading ? (
            <p className="text-sm text-zinc-500">Loading arrivals…</p>
          ) : null}

          {isError ? (
            <ErrorState
              title="Could not load stop arrivals"
              message={error?.message ?? "Unknown error"}
              onRetry={() => {
                void refetch();
              }}
            />
          ) : null}

          {!isLoading && !isError && routePredictions.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No upcoming buses predicted at this stop.
            </p>
          ) : null}

          {!isLoading && !isError && routePredictions.length > 0 ? (
            <div className="space-y-2">
              {routePredictions.map((prediction) => (
                <BusChip key={prediction.id} prediction={prediction} />
              ))}
            </div>
          ) : null}
        </div>

        <div className="border-t border-zinc-200 px-4 py-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Last updated {formatLastUpdated(new Date(dataUpdatedAt))}
        </div>
      </div>
    </div>
  );
}
