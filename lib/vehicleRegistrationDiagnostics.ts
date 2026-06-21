import type { LiveIbusRunningDetail } from "@/lib/ibusLookup";
import { extractVehicleFleetReference } from "@/lib/vehicles/lookupKey";
import {
  extractVehicleRegistration,
  normalizeUkRegistrationCandidate,
} from "@/lib/vehicles/registration";
import type {
  EstimatedVehiclePosition,
  NormalizedVehiclePrediction,
  VehicleRegistrationDiagnostic,
  VehicleRegistrationSource,
} from "@/lib/tfl/types";

function rawLooksLikeRegistration(rawVehicleId?: string): boolean {
  if (!rawVehicleId) {
    return false;
  }

  return normalizeUkRegistrationCandidate(rawVehicleId) !== undefined;
}

function resolveMissingReason(input: {
  showRegistrationEnabled: boolean;
  registration?: string;
  rawVehicleId?: string;
  fleetReference?: string;
  enrichmentLoaded: boolean;
  vehicleLookupStatus: VehicleRegistrationDiagnostic["vehicleLookupStatus"];
}): string | undefined {
  if (input.registration) {
    return undefined;
  }

  if (!input.showRegistrationEnabled) {
    return "display setting disabled";
  }

  if (!input.enrichmentLoaded) {
    return "enrichment not loaded";
  }

  if (input.vehicleLookupStatus === "not-found" && input.fleetReference) {
    return "vehicleId did not look like a registration and no static reverse lookup matched";
  }

  if (rawLooksLikeRegistration(input.rawVehicleId)) {
    return "data exists but not passed to marker";
  }

  return "vehicleId did not look like a registration and no static reverse lookup matched";
}

function resolveLookupNote(input: {
  registration?: string;
  rawVehicleId?: string;
  registrationSource: VehicleRegistrationSource;
  vehicleLookupStatus: VehicleRegistrationDiagnostic["vehicleLookupStatus"];
  runningLookupStatus: VehicleRegistrationDiagnostic["runningLookupStatus"];
  runningLookupNote?: string;
  runningLookupFailureReason?: string;
}): string | undefined {
  if (input.runningLookupNote) {
    return input.runningLookupNote;
  }

  if (
    input.registration &&
    input.registrationSource === "live-tfl-prediction" &&
    input.vehicleLookupStatus === "not-found"
  ) {
    return "Static iBus vehicle lookup did not match this registration, so fleet details may be unavailable.";
  }

  if (
    !input.registration &&
    rawLooksLikeRegistration(input.rawVehicleId)
  ) {
    return "Raw TfL vehicleId looked like a registration, but it was not attached to the live vehicle model.";
  }

  if (
    input.runningLookupStatus === "not-found" &&
    input.runningLookupFailureReason
  ) {
    return input.runningLookupFailureReason;
  }

  return undefined;
}

export function resolveVehicleRegistrationSource(
  vehicle: Pick<
    EstimatedVehiclePosition,
    "vehicleRegistration" | "vehicleRegistrationSource"
  >,
  prediction: NormalizedVehiclePrediction,
): VehicleRegistrationSource {
  if (vehicle.vehicleRegistrationSource) {
    return vehicle.vehicleRegistrationSource;
  }

  if (vehicle.vehicleRegistration || prediction.vehicleRegistration) {
    return "live-tfl-prediction";
  }

  return "unavailable";
}

export function buildVehicleRegistrationDiagnostics(input: {
  routeId: string;
  vehicles: EstimatedVehiclePosition[];
  showRegistrationEnabled: boolean;
  enrichmentLoaded: boolean;
  liveDetails?: Map<string, LiveIbusRunningDetail>;
}): VehicleRegistrationDiagnostic[] {
  return input.vehicles
    .filter((vehicle) => !vehicle.isScheduledGhostCandidate)
    .map((vehicle) => {
      const detail = input.liveDetails?.get(vehicle.vehicleId);
      const rawVehicleId = vehicle.vehicleId;
      const fleetReference =
        vehicle.vehicleFleetReference ??
        extractVehicleFleetReference(rawVehicleId);
      const registrationSource = resolveVehicleRegistrationSource(
        vehicle,
        vehicle.nextPrediction,
      );
      const vehicleLookupStatus =
        detail?.vehicleLookupStatus ??
        (input.enrichmentLoaded ? "not-found" : "not-loaded");
      const runningLookupStatus =
        detail?.runningLookupStatus ??
        (detail?.runningLookupAttempted ? "not-found" : "not-requested");

      return {
        routeId: input.routeId,
        vehicleId: vehicle.vehicleId,
        rawTflVehicleId: rawVehicleId,
        normalizedRegistration:
          vehicle.vehicleRegistration ??
          extractVehicleRegistration(rawVehicleId),
        vehicleFleetReference: fleetReference,
        ibusFleetNo: vehicle.ibusFleetNo ?? detail?.fleetNo,
        ibusRunningNo: vehicle.ibusRunningNo ?? detail?.runningNo,
        ibusBlockNo: vehicle.ibusBlockNo ?? detail?.blockNo,
        operatorCode: detail?.operatorCode,
        tripId: vehicle.tripId,
        liveBaseVersion: detail?.liveBaseVersion ?? vehicle.baseVersion,
        staticBaseVersion: detail?.staticBaseVersion,
        routeScheduleBaseVersion: detail?.routeScheduleBaseVersion,
        runningShardBaseVersion: detail?.runningShardBaseVersion,
        runningLookupShardId: detail?.runningLookupShardId,
        runningLookupKey: detail?.runningLookupKey,
        baseVersionMatches: detail?.baseVersionMatches,
        vehicleLookupStatus,
        vehicleLookupSource: detail?.vehicleLookupSource,
        runningLookupStatus,
        runningLookupNote: detail?.runningLookupNote,
        runningLookupFailureReason: detail?.runningLookupFailureReason,
        registrationSource,
        missingReason: resolveMissingReason({
          showRegistrationEnabled: input.showRegistrationEnabled,
          registration:
            vehicle.vehicleRegistration ??
            extractVehicleRegistration(rawVehicleId),
          rawVehicleId,
          fleetReference,
          enrichmentLoaded: input.enrichmentLoaded,
          vehicleLookupStatus,
        }),
        lookupNote: resolveLookupNote({
          registration:
            vehicle.vehicleRegistration ??
            extractVehicleRegistration(rawVehicleId),
          rawVehicleId,
          registrationSource,
          vehicleLookupStatus,
          runningLookupStatus,
          runningLookupNote: detail?.runningLookupNote,
          runningLookupFailureReason: detail?.runningLookupFailureReason,
        }),
      };
    });
}
