"use client";

import type { UseMapUserLocationResult } from "@/hooks/useMapUserLocation";
import { formatMapDistance } from "@/lib/mapUserLocation";

interface MapLocationControlsProps {
  location: UseMapUserLocationResult;
}

export function MapLocationControls({
  location,
}: MapLocationControlsProps): React.ReactElement {
  const { status, nearestStop, nearestStopLabel, error, enableLocation, findMe } =
    location;
  const showFindMe = status === "ready";
  const isLocating = status === "locating";
  const distanceLabel = nearestStop
    ? formatMapDistance(nearestStop.distanceMetres)
    : null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {showFindMe ? (
          <button
            type="button"
            onClick={findMe}
            className="min-h-11 rounded-xl border border-zinc-200 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Find me
          </button>
        ) : (
          <button
            type="button"
            onClick={enableLocation}
            disabled={isLocating}
            className="min-h-11 rounded-xl border border-sky-300 bg-sky-50 px-3 text-sm font-medium text-sky-800 hover:bg-sky-100 disabled:cursor-wait disabled:opacity-70 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-100 dark:hover:bg-sky-900"
          >
            {isLocating ? "Locating…" : "Use my location"}
          </button>
        )}

        {nearestStop && distanceLabel ? (
          <p
            className="min-h-11 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
            aria-live="polite"
            aria-label={nearestStopLabel ?? undefined}
          >
            <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {distanceLabel}
            </span>
            <span className="text-zinc-500 dark:text-zinc-400"> to </span>
            <span className="font-medium text-zinc-800 dark:text-zinc-100">
              {nearestStop.stop.name}
            </span>
          </p>
        ) : null}
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
        >
          <p className="font-medium">{error.title}</p>
          <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">
            {error.message}
          </p>
        </div>
      ) : null}
    </div>
  );
}
