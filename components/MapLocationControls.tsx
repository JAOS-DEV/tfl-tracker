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
      </div>

      {nearestStop && distanceLabel ? (
        <div
          className="rounded-xl border border-sky-300 bg-sky-50 px-3 py-3 dark:border-sky-700 dark:bg-sky-950"
          aria-live="polite"
          aria-label={nearestStopLabel ?? undefined}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-200">
            Nearest stop on this route
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-sky-950 dark:text-sky-50">
            {distanceLabel}
          </p>
          <p className="mt-0.5 text-sm font-medium text-sky-900 dark:text-sky-100">
            to {nearestStop.stop.name}
          </p>
        </div>
      ) : null}

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
