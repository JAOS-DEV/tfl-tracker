"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useSyncExternalStore } from "react";
import { collectActiveVehicleCandidates } from "@/lib/activeVehicleSearchIndex";
import type { ActiveRoute } from "@/lib/tfl/types";
import type { VehicleSearchCandidate } from "@/lib/vehicleSearch";

function buildCandidateSignature(
  candidates: VehicleSearchCandidate[],
): string {
  return candidates
    .map((candidate) =>
      [
        candidate.routeId,
        candidate.vehicle.vehicleId,
        candidate.vehicle.vehicleRegistration ?? "",
        candidate.vehicle.ibusRunningNo ?? "",
        candidate.vehicle.ibusFleetNo ?? "",
      ].join(":"),
    )
    .join("|");
}

type CacheSubscribe = (listener: () => void) => () => void;

export function subscribeToQueryCacheDeferred(
  subscribe: CacheSubscribe,
  onStoreChange: () => void,
): () => void {
  let active = true;
  let notificationTimer: ReturnType<typeof setTimeout> | null = null;
  const unsubscribe = subscribe(() => {
    if (notificationTimer !== null) {
      return;
    }
    notificationTimer = setTimeout(() => {
      notificationTimer = null;
      if (active) {
        onStoreChange();
      }
    }, 0);
  });

  return () => {
    active = false;
    if (notificationTimer !== null) {
      clearTimeout(notificationTimer);
      notificationTimer = null;
    }
    unsubscribe();
  };
}

export function useActiveVehicleSearchCandidates(
  activeRoutes: ActiveRoute[],
): VehicleSearchCandidate[] {
  const queryClient = useQueryClient();
  const cacheRef = useRef<{ signature: string; value: VehicleSearchCandidate[] }>(
    {
      signature: "",
      value: [],
    },
  );

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const queryCache = queryClient.getQueryCache();
      return subscribeToQueryCacheDeferred(
        (listener) => queryCache.subscribe(listener),
        onStoreChange,
      );
    },
    [queryClient],
  );

  const getSnapshot = useCallback(() => {
    const candidates = collectActiveVehicleCandidates(queryClient, activeRoutes);
    const signature = buildCandidateSignature(candidates);

    if (cacheRef.current.signature === signature) {
      return cacheRef.current.value;
    }

    cacheRef.current = { signature, value: candidates };
    return candidates;
  }, [activeRoutes, queryClient]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
