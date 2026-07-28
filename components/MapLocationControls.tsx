"use client";

import type { UseMapUserLocationResult } from "@/hooks/useMapUserLocation";
import { formatMapDistance } from "@/lib/mapUserLocation";

interface MapLocationControlsProps {
  location: UseMapUserLocationResult;
  /** Expanded map only — preview keeps opt-in + nearest stop, not Find me. */
  showFindMe?: boolean;
}

export function MapLocationControls({
  location,
  showFindMe = true,
}: MapLocationControlsProps): React.ReactElement {
  const { status, nearestStop, nearestStopLabel, error, enableLocation, findMe } =
    location;
  const isReady = status === "ready";
  const isLocating = status === "locating";
  const distanceLabel = nearestStop
    ? formatMapDistance(nearestStop.distanceMetres)
    : null;
  const showFindMeButton = showFindMe && isReady;
  const showUseMyLocation = !isReady;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {showFindMeButton ? (
          <button
            type="button"
            onClick={findMe}
            className="min-h-11 rounded-xl border border-zinc-200 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Find me
          </button>
        ) : null}

        {showUseMyLocation ? (
          <button
            type="button"
            onClick={enableLocation}
            disabled={isLocating}
            className="min-h-11 rounded-xl border border-sky-300 bg-sky-50 px-3 text-sm font-medium text-sky-800 hover:bg-sky-100 disabled:cursor-wait disabled:opacity-70 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-100 dark:hover:bg-sky-900"
          >
            {isLocating ? "Locating…" : "Use my location"}
          </button>
        ) : null}

        {nearestStop && distanceLabel ? (
          <p
            className="min-h-11 flex-1 rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-sm leading-snug text-sky-900 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-100"
            aria-live="polite"
            aria-label={nearestStopLabel ?? undefined}
          >
            <span className="font-medium text-sky-700 dark:text-sky-300">
              Nearest stop{" "}
            </span>
            <span className="font-semibold tabular-nums text-sky-950 dark:text-sky-50">
              {distanceLabel}
            </span>
            <span className="text-sky-700 dark:text-sky-300"> · </span>
            <span className="font-medium text-sky-950 dark:text-sky-50">
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
