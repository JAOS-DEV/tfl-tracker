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

export interface LineArrivalsResponse {
  routeId: string;
  predictions: NormalizedVehiclePrediction[];
  fetchedAt: string;
  replay?: {
    scenario: string;
    simulatedNow: string;
    provenance: "synthetic-known-sample" | "recorded-tfl-response";
  };
}

export function buildLineArrivalsUrl(
  routeId: string,
  replayScenario: string | null,
  nodeEnv: string | undefined,
): string {
  const params = new URLSearchParams({ routeId });
  if (
    nodeEnv !== "production" &&
    routeId.toLowerCase() === "14" &&
    replayScenario
  ) {
    params.set("replay", replayScenario);
  }
  return `/api/tfl/line-arrivals?${params.toString()}`;
}

async function fetchLineArrivals(
  routeId: string,
): Promise<LineArrivalsResponse> {
  const replayScenario = new URLSearchParams(window.location.search).get(
    "replay",
  );
  const response = await fetch(
    buildLineArrivalsUrl(routeId, replayScenario, process.env.NODE_ENV),
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
    queryKey: [
      "line-arrivals",
      routeId,
      typeof window === "undefined"
        ? null
        : new URLSearchParams(window.location.search).get("replay"),
    ],
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
