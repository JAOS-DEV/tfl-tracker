import { normalizeIbusRegistration } from "@/lib/ibus/keys";
import type { IbusVehicleRecord } from "@/lib/ibus/types";
import { normalizeRegistration } from "@/lib/vehicles/registration";

export type FleetRegistrationLookupStatus =
  | "matched"
  | "ambiguous"
  | "not-found";

export interface FleetRegistrationLookupResult {
  registration: string | null;
  status: FleetRegistrationLookupStatus;
  operatorAgency?: string;
}

export interface IbusVehicleReverseIndex {
  byFleet: Map<string, string[]>;
  byOperatorFleet: Map<string, string[]>;
}

const reverseIndexCache = new Map<string, IbusVehicleReverseIndex>();

function normalizeFleetNumber(value: string): string {
  return normalizeRegistration(value);
}

function normalizeOperatorAgency(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

function operatorFleetKey(
  operatorAgency: string | null | undefined,
  fleetNumber: string,
): string {
  return `${normalizeOperatorAgency(operatorAgency)}:${normalizeFleetNumber(fleetNumber)}`;
}

export function buildIbusVehicleReverseIndex(
  vehicleLookup: Record<string, IbusVehicleRecord>,
): IbusVehicleReverseIndex {
  const byFleet = new Map<string, string[]>();
  const byOperatorFleet = new Map<string, string[]>();

  for (const [registration, record] of Object.entries(vehicleLookup)) {
    const normalizedRegistration = normalizeIbusRegistration(registration);
    const fleetCandidates = new Set<string>([
      normalizeFleetNumber(record.fleetNo),
      normalizeFleetNumber(record.bonnetNo),
    ]);

    for (const fleetNumber of fleetCandidates) {
      if (!fleetNumber) {
        continue;
      }

      const fleetMatches = byFleet.get(fleetNumber) ?? [];
      if (!fleetMatches.includes(normalizedRegistration)) {
        fleetMatches.push(normalizedRegistration);
      }
      byFleet.set(fleetNumber, fleetMatches);

      const scopedKey = operatorFleetKey(record.operatorAgency, fleetNumber);
      const scopedMatches = byOperatorFleet.get(scopedKey) ?? [];
      if (!scopedMatches.includes(normalizedRegistration)) {
        scopedMatches.push(normalizedRegistration);
      }
      byOperatorFleet.set(scopedKey, scopedMatches);
    }
  }

  return { byFleet, byOperatorFleet };
}

export function getCachedIbusVehicleReverseIndex(
  baseVersion: string,
  vehicleLookup: Record<string, IbusVehicleRecord>,
): IbusVehicleReverseIndex {
  const cached = reverseIndexCache.get(baseVersion);
  if (cached) {
    return cached;
  }

  const built = buildIbusVehicleReverseIndex(vehicleLookup);
  reverseIndexCache.set(baseVersion, built);
  return built;
}

export function clearIbusVehicleReverseIndexCache(): void {
  reverseIndexCache.clear();
}

export function lookupVehicleByRegistration(
  vehicleLookup: Record<string, IbusVehicleRecord>,
  registrationInput: string,
): IbusVehicleRecord | null {
  const registration = normalizeIbusRegistration(registrationInput);
  return vehicleLookup[registration] ?? null;
}

export function lookupVehicleByFleetNumber(
  vehicleLookup: Record<string, IbusVehicleRecord>,
  fleetNumberInput: string,
  operatorCodeOrAgency?: string,
  reverseIndex?: IbusVehicleReverseIndex,
): FleetRegistrationLookupResult {
  const lookup = lookupRegistrationByFleetNumber(
    vehicleLookup,
    fleetNumberInput,
    operatorCodeOrAgency,
    reverseIndex,
  );

  if (!lookup.registration) {
    return lookup;
  }

  const vehicle = lookupVehicleByRegistration(
    vehicleLookup,
    lookup.registration,
  );

  return {
    ...lookup,
    operatorAgency: vehicle?.operatorAgency ?? undefined,
  };
}

export function lookupRegistrationByFleetNumber(
  vehicleLookup: Record<string, IbusVehicleRecord>,
  fleetNumberInput: string,
  operatorCodeOrAgency?: string,
  reverseIndex?: IbusVehicleReverseIndex,
): FleetRegistrationLookupResult {
  const fleetNumber = normalizeFleetNumber(fleetNumberInput);
  if (!fleetNumber) {
    return { registration: null, status: "not-found" };
  }

  const index =
    reverseIndex ?? buildIbusVehicleReverseIndex(vehicleLookup);

  if (operatorCodeOrAgency) {
    const scopedMatches =
      index.byOperatorFleet.get(
        operatorFleetKey(operatorCodeOrAgency, fleetNumber),
      ) ?? [];
    if (scopedMatches.length === 1) {
      return {
        registration: scopedMatches[0] ?? null,
        status: "matched",
      };
    }
    if (scopedMatches.length > 1) {
      return { registration: null, status: "ambiguous" };
    }
  }

  const globalMatches = index.byFleet.get(fleetNumber) ?? [];
  if (globalMatches.length === 1) {
    return {
      registration: globalMatches[0] ?? null,
      status: "matched",
    };
  }
  if (globalMatches.length > 1) {
    return { registration: null, status: "ambiguous" };
  }

  return { registration: null, status: "not-found" };
}
