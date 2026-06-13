import { preferFleetDisplay } from "@/lib/vehicles/display";
import type { FleetFallbackResult } from "@/lib/vehicles/fleetFallbackSchemas";
import { normalizeRegistration } from "@/lib/vehicles/registration";
import {
  bustimesVehicleListSchema,
  bustimesVehicleSchema,
} from "@/lib/vehicles/schemas";
import type { z } from "zod";

const BUSTIMES_VEHICLES_URL = "https://bustimes.org/api/vehicles/";
const BUSTIMES_FETCH_TIMEOUT_MS = 8_000;
const SUCCESS_TTL_MS = 24 * 60 * 60 * 1000;
const NO_MATCH_TTL_MS = 6 * 60 * 60 * 1000;
const FAILURE_TTL_MS = 5 * 60 * 1000;

interface FleetFallbackCacheEntry {
  result: FleetFallbackResult;
  expiresAt: number;
}

const fleetFallbackCache = new Map<string, FleetFallbackCacheEntry>();

function readFleetFallbackCache(
  cacheKey: string,
  now: number,
): FleetFallbackResult | null {
  const entry = fleetFallbackCache.get(cacheKey);
  if (!entry || entry.expiresAt <= now) {
    fleetFallbackCache.delete(cacheKey);
    return null;
  }

  return entry.result;
}

function writeFleetFallbackCache(
  cacheKey: string,
  result: FleetFallbackResult,
  now: number,
): void {
  const ttl =
    result.status === "found"
      ? SUCCESS_TTL_MS
      : result.status === "not_found"
        ? NO_MATCH_TTL_MS
        : FAILURE_TTL_MS;

  fleetFallbackCache.set(cacheKey, {
    result,
    expiresAt: now + ttl,
  });
}

export function clearFleetFallbackCache(): void {
  fleetFallbackCache.clear();
}

type BustimesVehicle = z.infer<typeof bustimesVehicleSchema>;

function toNullableString(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

async function fetchBustimesByRegistration(
  registration: string,
): Promise<BustimesVehicle[]> {
  const url = new URL(BUSTIMES_VEHICLES_URL);
  url.searchParams.set("search", registration);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BUSTIMES_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      throw new Error(`Bustimes request failed with status ${response.status}`);
    }

    const payload = bustimesVehicleListSchema.parse(await response.json());
    return payload.results.filter(
      (vehicle) =>
        normalizeRegistration(vehicle.reg) === registration,
    );
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeFleetFallback(
  registration: string,
  vehicle: BustimesVehicle,
): FleetFallbackResult {
  const fleetCode = toNullableString(vehicle.fleet_code);
  const fleetNumber = toNullableString(vehicle.fleet_number);
  const fleetNo = preferFleetDisplay(fleetCode, fleetNumber);

  return {
    registration,
    status: "found",
    fleetNo,
    fleetCode,
    operatorName: toNullableString(vehicle.operator?.name),
    garageCode: toNullableString(vehicle.garage?.code),
    vehicleTypeName: toNullableString(vehicle.vehicle_type?.name),
    fuel: toNullableString(vehicle.vehicle_type?.fuel),
    isElectric: vehicle.vehicle_type?.electric ?? false,
    isDoubleDecker: vehicle.vehicle_type?.double_decker ?? false,
    withdrawn: vehicle.withdrawn ?? false,
    source: "bustimes",
  };
}

export async function lookupFleetFallback(
  registrationInput: string,
): Promise<FleetFallbackResult> {
  const registration = normalizeRegistration(registrationInput);
  const cacheKey = `fleet-fallback:${registration}`;
  const now = Date.now();
  const cached = readFleetFallbackCache(cacheKey, now);

  if (cached) {
    return cached;
  }

  try {
    const matches = await fetchBustimesByRegistration(registration);
    const match = matches[0];

    if (!match) {
      const result: FleetFallbackResult = {
        registration,
        status: "not_found",
        fleetNo: null,
        fleetCode: null,
        operatorName: null,
        garageCode: null,
        vehicleTypeName: null,
        fuel: null,
        isElectric: false,
        isDoubleDecker: false,
        withdrawn: false,
        source: "bustimes",
      };

      writeFleetFallbackCache(cacheKey, result, now);

      return result;
    }

    const result = normalizeFleetFallback(registration, match);
    writeFleetFallbackCache(cacheKey, result, now);

    return result;
  } catch {
    const result: FleetFallbackResult = {
      registration,
      status: "unavailable",
      fleetNo: null,
      fleetCode: null,
      operatorName: null,
      garageCode: null,
      vehicleTypeName: null,
      fuel: null,
      isElectric: false,
      isDoubleDecker: false,
      withdrawn: false,
      source: "bustimes",
    };

    writeFleetFallbackCache(cacheKey, result, now);

    return result;
  }
}
