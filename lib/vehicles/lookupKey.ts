import {
  extractVehicleRegistration,
  isUkRegistrationPlate,
  normalizeRegistration,
} from "@/lib/vehicles/registration";

export type VehicleLookupMode = "registration" | "fleet_reference";

export interface VehicleLookupKey {
  queryKey: string;
  mode: VehicleLookupMode;
}

const FLEET_REFERENCE_PATTERN = /^[A-Z]{2,4}\d{1,4}$/;

export function isFleetReference(value: string): boolean {
  const normalized = normalizeRegistration(value);
  if (!normalized || isUkRegistrationPlate(normalized)) {
    return false;
  }

  return (
    FLEET_REFERENCE_PATTERN.test(normalized) &&
    normalized.length >= 4 &&
    normalized.length <= 8
  );
}

export function extractVehicleFleetReference(
  vehicleId?: string,
): string | undefined {
  if (!vehicleId) {
    return undefined;
  }

  const normalized = normalizeRegistration(vehicleId);
  if (!isFleetReference(normalized)) {
    return undefined;
  }

  return normalized;
}

export function buildVehicleLookupKeys(
  vehicleId?: string,
  vehicleRegistration?: string,
): VehicleLookupKey[] {
  const keys: VehicleLookupKey[] = [];
  const seen = new Set<string>();

  const addKey = (queryKey: string, mode: VehicleLookupMode): void => {
    if (seen.has(queryKey)) {
      return;
    }
    seen.add(queryKey);
    keys.push({ queryKey, mode });
  };

  const registration =
    vehicleRegistration ?? extractVehicleRegistration(vehicleId);
  if (registration) {
    addKey(registration, "registration");
  }

  const fleetReference = extractVehicleFleetReference(vehicleId);
  if (fleetReference) {
    addKey(fleetReference, "fleet_reference");
  }

  return keys;
}

export function buildPrimaryVehicleLookupKey(
  vehicleId?: string,
  vehicleRegistration?: string,
): VehicleLookupKey | null {
  return buildVehicleLookupKeys(vehicleId, vehicleRegistration)[0] ?? null;
}
