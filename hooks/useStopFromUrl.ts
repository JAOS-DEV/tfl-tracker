"use client";

import { useEffect, useRef } from "react";
import type { FavouriteStop } from "@/lib/favouriteStops";
import { parseStopParam } from "@/lib/routeUrl";
import type { StopDetailTarget } from "@/lib/stopDetail";

interface UseStopFromUrlOptions {
  isHydrated: boolean;
  favouriteStops: FavouriteStop[];
  onOpenStop: (stop: StopDetailTarget) => void;
}

export function useStopFromUrl({
  isHydrated,
  favouriteStops,
  onOpenStop,
}: UseStopFromUrlOptions): void {
  const hasOpenedFromUrl = useRef(false);

  useEffect(() => {
    if (!isHydrated || hasOpenedFromUrl.current) {
      return;
    }

    const stopPointId = parseStopParam(
      new URLSearchParams(window.location.search).get("stop"),
    );

    if (!stopPointId) {
      return;
    }

    hasOpenedFromUrl.current = true;
    const favourite = favouriteStops.find(
      (stop) => stop.stopPointId === stopPointId,
    );

    onOpenStop(
      favourite ?? {
        stopPointId,
        name: stopPointId,
      },
    );
  }, [favouriteStops, isHydrated, onOpenStop]);
}
