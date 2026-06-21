"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useDocumentVisibility } from "@/hooks/useDocumentVisibility";
import type { NormalizedVehiclePrediction } from "@/lib/tfl/types";
import {
  getRemainingRefetchIntervalMs,
  shouldRefetchOnVisibilityRestore,
} from "@/lib/liveRefreshStatus";
import { POLL_INTERVAL_MS } from "@/lib/storage";

interface LineArrivalsResponse {
  routeId: string;
  predictions: NormalizedVehiclePrediction[];
  fetchedAt: string;
}

async function fetchLineArrivals(
  routeId: string,
): Promise<LineArrivalsResponse> {
  const response = await fetch(
    `/api/tfl/line-arrivals?routeId=${encodeURIComponent(routeId)}`,
  );

  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? "Failed to load line arrivals");
  }

  return response.json() as Promise<LineArrivalsResponse>;
}

export function useLineArrivals(routeId: string) {
  const isDocumentVisible = useDocumentVisibility();
  const wasVisibleRef = useRef(isDocumentVisible);

  const query = useQuery({
    queryKey: ["line-arrivals", routeId],
    queryFn: () => fetchLineArrivals(routeId),
    refetchInterval: isDocumentVisible
      ? (currentQuery) =>
          getRemainingRefetchIntervalMs(
            currentQuery.state.dataUpdatedAt,
            Date.now(),
            POLL_INTERVAL_MS,
          )
      : false,
    refetchIntervalInBackground: false,
    staleTime: POLL_INTERVAL_MS,
    placeholderData: keepPreviousData,
    enabled: Boolean(routeId),
  });

  const { dataUpdatedAt, refetch } = query;

  useEffect(() => {
    const becameVisible = isDocumentVisible && !wasVisibleRef.current;
    wasVisibleRef.current = isDocumentVisible;

    if (
      becameVisible &&
      shouldRefetchOnVisibilityRestore(dataUpdatedAt, Date.now())
    ) {
      void refetch();
    }
  }, [isDocumentVisible, dataUpdatedAt, refetch]);

  return query;
}
