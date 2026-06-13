import { NextRequest } from "next/server";
import { handleApiErrorResponse, jsonResponse } from "@/lib/api";
import { lookupVehicleEnrichmentForVehicle } from "@/lib/vehicles/bustimes";
import { vehicleEnrichmentCache } from "@/lib/vehicles/cache";
import {
  resolveLookupKeysForRequest,
  vehicleEnrichmentQuerySchema,
} from "@/lib/vehicles/schemas";
import type {
  VehicleEnrichmentBatchResponse,
  VehicleEnrichmentResult,
} from "@/lib/vehicles/types";

async function resolveCachedVehicleEnrichment(
  vehicleId?: string,
  vehicleRegistration?: string,
  now = Date.now(),
): Promise<VehicleEnrichmentResult | null> {
  const lookupKeys = resolveLookupKeysForRequest({
    vehicleId,
    vehicleRegistration,
  });

  for (const lookup of lookupKeys) {
    const cached = vehicleEnrichmentCache.get(lookup.queryKey, now);
    if (cached?.status === "found") {
      return cached;
    }
  }

  const result = await lookupVehicleEnrichmentForVehicle(
    vehicleId,
    vehicleRegistration,
    (attempt) => vehicleEnrichmentCache.set(attempt, now),
  );

  if (!result) {
    return null;
  }

  return result;
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const { requests } = vehicleEnrichmentQuerySchema.parse({
      reg: request.nextUrl.searchParams.get("reg") ?? undefined,
      regs: request.nextUrl.searchParams.get("regs") ?? undefined,
      vehicleId: request.nextUrl.searchParams.get("vehicleId") ?? undefined,
      vehicleIds: request.nextUrl.searchParams.get("vehicleIds") ?? undefined,
    });

    const now = Date.now();
    const results = await Promise.all(
      requests.map(async (requestItem) => {
        const result = await resolveCachedVehicleEnrichment(
          requestItem.vehicleId,
          requestItem.vehicleRegistration,
          now,
        );

        if (result) {
          return result;
        }

        return {
          queryKey: requestItem.vehicleId ?? requestItem.vehicleRegistration ?? "unknown",
          queryMode: requestItem.vehicleRegistration
            ? "registration"
            : "fleet_reference",
          status: "not_found",
          enrichment: null,
        } satisfies VehicleEnrichmentResult;
      }),
    );

    const response: VehicleEnrichmentBatchResponse = {
      results,
      fetchedAt: new Date().toISOString(),
    };

    return jsonResponse(response);
  } catch (error) {
    return handleApiErrorResponse(error);
  }
}
