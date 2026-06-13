import { preferFleetDisplay } from "@/lib/vehicles/display";
import type { VehicleLookupKey } from "@/lib/vehicles/lookupKey";
import { buildVehicleLookupKeys } from "@/lib/vehicles/lookupKey";
import { normalizeRegistration } from "@/lib/vehicles/registration";
import {
  bustimesVehicleListSchema,
  bustimesVehicleSchema,
} from "@/lib/vehicles/schemas";
import type {
  VehicleEnrichment,
  VehicleEnrichmentResult,
} from "@/lib/vehicles/types";
import type { z } from "zod";

const BUSTIMES_VEHICLES_URL = "https://bustimes.org/api/vehicles/";
const BUSTIMES_FETCH_TIMEOUT_MS = 8_000;

type BustimesVehicle = z.infer<typeof bustimesVehicleSchema>;

function toNullableString(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function enrichmentRegistration(vehicle: BustimesVehicle): string | null {
  const registration = toNullableString(vehicle.reg);
  if (!registration) {
    return null;
  }

  return normalizeRegistration(registration);
}

export function normalizeBustimesVehicle(
  vehicle: BustimesVehicle,
  fetchedAt: string,
): VehicleEnrichment {
  const fleetNumber = toNullableString(vehicle.fleet_number);
  const fleetCode = toNullableString(vehicle.fleet_code);

  return {
    registration: enrichmentRegistration(vehicle),
    fleetNumber,
    fleetCode,
    operatorId: toNullableString(vehicle.operator?.id),
    operatorName: toNullableString(vehicle.operator?.name),
    operatorSlug: toNullableString(vehicle.operator?.slug),
    garageCode: toNullableString(vehicle.garage?.code),
    garageName: toNullableString(vehicle.garage?.name),
    vehicleTypeName: toNullableString(vehicle.vehicle_type?.name),
    fuel: toNullableString(vehicle.vehicle_type?.fuel),
    isDoubleDecker: vehicle.vehicle_type?.double_decker ?? false,
    isElectric: vehicle.vehicle_type?.electric ?? false,
    liveryName: toNullableString(vehicle.livery?.name),
    withdrawn: vehicle.withdrawn ?? false,
    specialFeatures: toNullableString(vehicle.special_features),
    source: "bustimes",
    fetchedAt,
  };
}

function pickBestMatchForRegistration(
  registration: string,
  results: BustimesVehicle[],
): BustimesVehicle | null {
  const exact = results.find(
    (vehicle) => enrichmentRegistration(vehicle) === registration,
  );

  if (exact) {
    return exact;
  }

  if (results.length === 1) {
    return results[0] ?? null;
  }

  return null;
}

function pickBestMatchForFleetReference(
  fleetReference: string,
  results: BustimesVehicle[],
): BustimesVehicle | null {
  const ref = normalizeRegistration(fleetReference);

  const exactMatches = results.filter((vehicle) => {
    const fleetCode = normalizeRegistration(vehicle.fleet_code ?? "");
    const fleetNumber = normalizeRegistration(String(vehicle.fleet_number ?? ""));
    const registration = enrichmentRegistration(vehicle) ?? "";

    return fleetCode === ref || fleetNumber === ref || registration === ref;
  });

  if (exactMatches.length === 1) {
    return exactMatches[0] ?? null;
  }

  if (exactMatches.length > 1) {
    return (
      exactMatches.find(
        (vehicle) => normalizeRegistration(vehicle.fleet_code ?? "") === ref,
      ) ??
      exactMatches.find(
        (vehicle) => enrichmentRegistration(vehicle) === ref,
      ) ??
      exactMatches.find(
        (vehicle) =>
          normalizeRegistration(String(vehicle.fleet_number ?? "")) === ref,
      ) ??
      null
    );
  }

  if (results.length === 1) {
    return results[0] ?? null;
  }

  return null;
}

function pickBestMatch(
  lookup: VehicleLookupKey,
  results: BustimesVehicle[],
): BustimesVehicle | null {
  if (lookup.mode === "registration") {
    return pickBestMatchForRegistration(lookup.queryKey, results);
  }

  return pickBestMatchForFleetReference(lookup.queryKey, results);
}

async function fetchBustimesSearch(query: string): Promise<BustimesVehicle[]> {
  const url = new URL(BUSTIMES_VEHICLES_URL);
  url.searchParams.set("search", query);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BUSTIMES_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      throw new Error(`Bustimes request failed with status ${response.status}`);
    }

    const payload = bustimesVehicleListSchema.parse(await response.json());
    return payload.results;
  } finally {
    clearTimeout(timeout);
  }
}

async function lookupWithKey(
  lookup: VehicleLookupKey,
): Promise<VehicleEnrichmentResult> {
  const fetchedAt = new Date().toISOString();

  try {
    const results = await fetchBustimesSearch(lookup.queryKey);
    const match = pickBestMatch(lookup, results);

    if (!match) {
      return {
        queryKey: lookup.queryKey,
        queryMode: lookup.mode,
        status: "not_found",
        enrichment: null,
      };
    }

    return {
      queryKey: lookup.queryKey,
      queryMode: lookup.mode,
      status: "found",
      enrichment: normalizeBustimesVehicle(match, fetchedAt),
    };
  } catch {
    return {
      queryKey: lookup.queryKey,
      queryMode: lookup.mode,
      status: "unavailable",
      enrichment: null,
      message: "Vehicle details temporarily unavailable",
    };
  }
}

export async function lookupVehicleEnrichment(
  lookup: VehicleLookupKey,
): Promise<VehicleEnrichmentResult> {
  return lookupWithKey(lookup);
}

export async function lookupVehicleEnrichmentForVehicle(
  vehicleId?: string,
  vehicleRegistration?: string,
  onResult?: (result: VehicleEnrichmentResult) => void,
): Promise<VehicleEnrichmentResult | null> {
  const lookupKeys = buildVehicleLookupKeys(vehicleId, vehicleRegistration);
  if (lookupKeys.length === 0) {
    return null;
  }

  let lastResult: VehicleEnrichmentResult | null = null;

  for (const lookup of lookupKeys) {
    const result = await lookupWithKey(lookup);
    onResult?.(result);
    lastResult = result;

    if (result.status === "found") {
      return result;
    }

    if (result.status === "unavailable") {
      return result;
    }
  }

  return lastResult;
}

export function getPreferredFleetLabel(
  enrichment: VehicleEnrichment | null | undefined,
): string | null {
  if (!enrichment) {
    return null;
  }

  return preferFleetDisplay(enrichment.fleetCode, enrichment.fleetNumber);
}
