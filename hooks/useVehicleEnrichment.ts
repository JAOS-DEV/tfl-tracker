"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  VehicleEnrichmentBatchResponse,
  VehicleEnrichmentRequest,
  VehicleEnrichmentResult,
} from "@/lib/vehicles/types";

const ENRICHMENT_STALE_TIME_MS = 24 * 60 * 60 * 1000;
const ENRICHMENT_GC_TIME_MS = 24 * 60 * 60 * 1000;

function buildVehicleQueryKey(request: VehicleEnrichmentRequest): string {
  return [
    request.vehicleId ?? "",
    request.vehicleRegistration ?? "",
    request.vehicleFleetReference ?? "",
  ].join("|");
}

function unavailableResult(request: VehicleEnrichmentRequest): VehicleEnrichmentResult {
  return {
    queryKey:
      request.vehicleRegistration ??
      request.vehicleFleetReference ??
      request.vehicleId ??
      "unknown",
    queryMode: request.vehicleRegistration ? "registration" : "fleet_reference",
    status: "unavailable",
    enrichment: null,
    message: "Vehicle details temporarily unavailable",
  };
}

async function fetchVehicleEnrichment(
  request: VehicleEnrichmentRequest,
): Promise<VehicleEnrichmentResult> {
  const params = new URLSearchParams();

  if (request.vehicleId) {
    params.set("vehicleId", request.vehicleId);
  } else if (request.vehicleRegistration) {
    params.set("reg", request.vehicleRegistration);
  } else if (request.vehicleFleetReference) {
    params.set("vehicleId", request.vehicleFleetReference);
  }

  const response = await fetch(`/api/vehicles/enrichment?${params.toString()}`);

  if (!response.ok) {
    return unavailableResult(request);
  }

  const payload = (await response.json()) as VehicleEnrichmentBatchResponse;
  return payload.results[0] ?? unavailableResult(request);
}

async function fetchVehicleEnrichments(
  requests: VehicleEnrichmentRequest[],
): Promise<VehicleEnrichmentBatchResponse> {
  const uniqueRequests = [
    ...new Map(
      requests.map((request) => [buildVehicleQueryKey(request), request]),
    ).values(),
  ].slice(0, 10);

  if (uniqueRequests.length === 0) {
    return {
      results: [],
      fetchedAt: new Date().toISOString(),
    };
  }

  const vehicleIds = uniqueRequests
    .map((request) => request.vehicleId ?? request.vehicleFleetReference)
    .filter(Boolean) as string[];

  const params = new URLSearchParams();
  if (vehicleIds.length > 0) {
    params.set("vehicleIds", vehicleIds.join(","));
  } else {
    params.set(
      "regs",
      uniqueRequests
        .map((request) => request.vehicleRegistration)
        .filter(Boolean)
        .join(","),
    );
  }

  const response = await fetch(`/api/vehicles/enrichment?${params.toString()}`);

  if (!response.ok) {
    return {
      results: uniqueRequests.map(unavailableResult),
      fetchedAt: new Date().toISOString(),
    };
  }

  return response.json() as Promise<VehicleEnrichmentBatchResponse>;
}

export function useVehicleEnrichment(
  request: VehicleEnrichmentRequest | undefined,
  enabled = true,
) {
  const hasLookupTarget = Boolean(
    request?.vehicleId ||
      request?.vehicleRegistration ||
      request?.vehicleFleetReference,
  );

  return useQuery({
    queryKey: ["vehicle-enrichment", buildVehicleQueryKey(request ?? {})],
    queryFn: () => fetchVehicleEnrichment(request!),
    enabled: enabled && hasLookupTarget,
    staleTime: ENRICHMENT_STALE_TIME_MS,
    gcTime: ENRICHMENT_GC_TIME_MS,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useVehicleEnrichments(
  requests: VehicleEnrichmentRequest[],
  enabled = true,
) {
  const normalizedRequests = [...requests]
    .filter(
      (request) =>
        request.vehicleId ||
        request.vehicleRegistration ||
        request.vehicleFleetReference,
    )
    .sort((left, right) =>
      buildVehicleQueryKey(left).localeCompare(buildVehicleQueryKey(right)),
    );

  return useQuery({
    queryKey: [
      "vehicle-enrichment-batch",
      normalizedRequests.map(buildVehicleQueryKey).join(","),
    ],
    queryFn: () => fetchVehicleEnrichments(normalizedRequests),
    enabled: enabled && normalizedRequests.length > 0,
    staleTime: ENRICHMENT_STALE_TIME_MS,
    gcTime: ENRICHMENT_GC_TIME_MS,
    retry: 1,
    refetchOnWindowFocus: false,
    select: (data) => {
      const byVehicle = new Map<string, VehicleEnrichmentResult>();
      for (const result of data.results) {
        byVehicle.set(result.queryKey, result);
      }
      return byVehicle;
    },
  });
}
