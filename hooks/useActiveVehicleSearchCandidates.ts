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
    (onStoreChange: () => void) =>
      queryClient.getQueryCache().subscribe(onStoreChange),
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
