import {
  createRunningLookupKey,
  runningShardForTripId,
} from "@/lib/ibus/keys";
import type {
  IbusCurrentManifest,
  IbusDetailsResult,
  IbusGarageRecord,
  IbusPredictionInput,
  IbusRunningRecord,
  IbusVehicleRecord,
} from "@/lib/ibus/types";
import {
  clearIbusVehicleReverseIndexCache,
  getCachedIbusVehicleReverseIndex,
  lookupRegistrationByFleetNumber,
  lookupVehicleByRegistration,
} from "@/lib/ibusVehicleLookup";
import { extractVehicleRegistration } from "@/lib/vehicles/registration";
import { extractVehicleFleetReference } from "@/lib/vehicles/lookupKey";

const manifestCache = {
  promise: null as Promise<IbusCurrentManifest | null> | null,
  value: null as IbusCurrentManifest | null,
};

const vehicleLookupCache = new Map<string, Promise<Record<string, IbusVehicleRecord> | null>>();
const garageLookupCache = new Map<string, Promise<Record<string, IbusGarageRecord> | null>>();
const runningShardCache = new Map<string, Promise<Record<string, IbusRunningRecord> | null>>();

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      cache: url.includes("/data/ibus/current.json") ? "default" : "force-cache",
    });
    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function loadIbusManifest(): Promise<IbusCurrentManifest | null> {
  if (manifestCache.value) {
    return manifestCache.value;
  }

  manifestCache.promise ??= fetchJson<IbusCurrentManifest>("/data/ibus/current.json");
  const manifest = await manifestCache.promise;
  manifestCache.value = manifest;
  return manifest;
}

export function clearIbusLookupCache(): void {
  manifestCache.promise = null;
  manifestCache.value = null;
  vehicleLookupCache.clear();
  garageLookupCache.clear();
  runningShardCache.clear();
  clearIbusVehicleReverseIndexCache();
}

async function loadVehicleLookup(
  manifest: IbusCurrentManifest,
): Promise<Record<string, IbusVehicleRecord> | null> {
  const cached = vehicleLookupCache.get(manifest.baseVersion);
  if (cached) {
    return cached;
  }

  const promise = fetchJson<Record<string, IbusVehicleRecord>>(
    manifest.vehicleLookupPath,
  );
  vehicleLookupCache.set(manifest.baseVersion, promise);
  return promise;
}

async function loadGarageLookup(
  manifest: IbusCurrentManifest,
): Promise<Record<string, IbusGarageRecord> | null> {
  const cached = garageLookupCache.get(manifest.baseVersion);
  if (cached) {
    return cached;
  }

  const promise = fetchJson<Record<string, IbusGarageRecord>>(
    manifest.garageLookupPath,
  );
  garageLookupCache.set(manifest.baseVersion, promise);
  return promise;
}

async function loadRunningShard(
  manifest: IbusCurrentManifest,
  tripId: string,
): Promise<Record<string, IbusRunningRecord> | null> {
  const shard = runningShardForTripId(tripId);
  const cacheKey = `${manifest.baseVersion}:${shard}`;
  const cached = runningShardCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const shardPath = manifest.runningShardPathTemplate.replace("{shard}", shard);
  const promise = fetchJson<Record<string, IbusRunningRecord>>(shardPath);
  runningShardCache.set(cacheKey, promise);
  return promise;
}

export interface LiveIbusRunningDetail {
  runningNo?: string;
  blockNo?: string;
  fleetNo?: string;
  operatorCode?: string;
  registration?: string;
  registrationSource?:
    | "live-tfl-prediction"
    | "ibus-registration-lookup"
    | "ibus-fleet-reverse-lookup";
  registrationLookupStatus?: "matched" | "ambiguous" | "not-found" | "not-needed";
}

function enrichRegistrationFromVehicleLookup(
  prediction: IbusPredictionInput,
  existing: LiveIbusRunningDetail | undefined,
  vehicleLookup: Record<string, IbusVehicleRecord>,
  reverseIndex: ReturnType<typeof getCachedIbusVehicleReverseIndex>,
): LiveIbusRunningDetail {
  const vehicleKey = prediction.vehicleId;
  if (!vehicleKey) {
    return existing ?? {};
  }

  const liveRegistration = extractVehicleRegistration(vehicleKey);
  const fleetReference = extractVehicleFleetReference(vehicleKey);
  const operatorCode = existing?.operatorCode;

  if (liveRegistration) {
    const vehicle = lookupVehicleByRegistration(vehicleLookup, liveRegistration);
    return {
      ...existing,
      registration: liveRegistration,
      registrationSource: "live-tfl-prediction",
      registrationLookupStatus: vehicle ? "matched" : "not-found",
      ...(vehicle?.fleetNo ? { fleetNo: vehicle.fleetNo } : {}),
    };
  }

  const fleetCandidate =
    existing?.fleetNo ?? fleetReference ?? vehicleKey.trim().toUpperCase();
  const reverseLookup = lookupRegistrationByFleetNumber(
    vehicleLookup,
    fleetCandidate,
    operatorCode,
    reverseIndex,
  );

  if (reverseLookup.status === "matched" && reverseLookup.registration) {
    const vehicle = lookupVehicleByRegistration(
      vehicleLookup,
      reverseLookup.registration,
    );
    return {
      ...existing,
      registration: reverseLookup.registration,
      registrationSource: "ibus-fleet-reverse-lookup",
      registrationLookupStatus: "matched",
      fleetNo: vehicle?.fleetNo ?? fleetCandidate,
    };
  }

  if (reverseLookup.status === "ambiguous") {
    return {
      ...existing,
      registrationLookupStatus: "ambiguous",
      ...(fleetReference || existing?.fleetNo
        ? { fleetNo: existing?.fleetNo ?? fleetReference }
        : {}),
    };
  }

  return {
    ...existing,
    registrationLookupStatus: fleetCandidate ? "not-found" : "not-needed",
    ...(fleetReference || existing?.fleetNo
      ? { fleetNo: existing?.fleetNo ?? fleetReference }
      : {}),
  };
}

export async function resolveLiveRunningDetailsForPredictions(
  predictions: IbusPredictionInput[],
): Promise<Map<string, LiveIbusRunningDetail>> {
  const manifest = await loadIbusManifest();
  const result = new Map<string, LiveIbusRunningDetail>();
  if (!manifest) {
    return result;
  }

  const shardEntries = new Map<
    string,
    Array<{ vehicleKey: string; lookupKey: string; tripId: string }>
  >();

  for (const prediction of predictions) {
    const vehicleKey = prediction.vehicleId;
    if (!vehicleKey || !prediction.tripId || !prediction.baseVersion) {
      continue;
    }
    if (prediction.baseVersion !== manifest.baseVersion) {
      continue;
    }

    const shard = runningShardForTripId(prediction.tripId);
    const lookupKey = createRunningLookupKey(
      prediction.baseVersion,
      prediction.tripId,
    );
    const existing = shardEntries.get(shard) ?? [];
    existing.push({ vehicleKey, lookupKey, tripId: prediction.tripId });
    shardEntries.set(shard, existing);
  }

  for (const entries of shardEntries.values()) {
    const sampleTripId = entries[0]?.tripId;
    if (!sampleTripId) {
      continue;
    }

    const shardData = await loadRunningShard(manifest, sampleTripId);
    if (!shardData) {
      continue;
    }

    for (const entry of entries) {
      if (result.has(entry.vehicleKey)) {
        continue;
      }

      const running = shardData[entry.lookupKey];
      if (!running?.runningNo) {
        continue;
      }

      result.set(entry.vehicleKey, {
        runningNo: running.runningNo,
        blockNo: running.blockNo,
        operatorCode: running.operatorCode ?? undefined,
      });
    }
  }

  const vehicleLookup = await loadVehicleLookup(manifest);
  if (!vehicleLookup) {
    return result;
  }

  const reverseIndex = getCachedIbusVehicleReverseIndex(
    manifest.baseVersion,
    vehicleLookup,
  );

  for (const prediction of predictions) {
    const vehicleKey = prediction.vehicleId;
    if (!vehicleKey) {
      continue;
    }

    const enriched = enrichRegistrationFromVehicleLookup(
      prediction,
      result.get(vehicleKey),
      vehicleLookup,
      reverseIndex,
    );
    result.set(vehicleKey, enriched);
  }

  return result;
}

export async function getIbusDetailsForPrediction(
  input: IbusPredictionInput,
): Promise<IbusDetailsResult | null> {
  try {
    const manifest = await loadIbusManifest();
    if (!manifest) {
      return {
        status: "missing-static-data",
        message: "TfL iBus static data is not available in this build.",
        fleetSource: "none",
        runningNumberSource: "none",
      };
    }

    const liveRegistration = extractVehicleRegistration(input.vehicleId);
    const fleetReference = extractVehicleFleetReference(input.vehicleId);

    const result: IbusDetailsResult = {
      registration: liveRegistration,
      registrationSource: liveRegistration ? "live-tfl-prediction" : undefined,
      sourceBaseVersion: manifest.baseVersion,
      fleetSource: "none",
      runningNumberSource: "none",
      status: "not-found",
    };

    const vehicleLookup = await loadVehicleLookup(manifest);

    if (liveRegistration && vehicleLookup) {
      const vehicle = lookupVehicleByRegistration(vehicleLookup, liveRegistration);
      if (vehicle) {
        result.fleetNo = vehicle.fleetNo;
        result.bonnetNo = vehicle.bonnetNo;
        result.operatorAgency = vehicle.operatorAgency ?? undefined;
        result.fleetSource = "tfl-ibus-static";
        result.status = "partial";
      }
    } else if (vehicleLookup && (fleetReference || input.vehicleId)) {
      const reverseIndex = getCachedIbusVehicleReverseIndex(
        manifest.baseVersion,
        vehicleLookup,
      );
      const reverseLookup = lookupRegistrationByFleetNumber(
        vehicleLookup,
        fleetReference ?? input.vehicleId ?? "",
        undefined,
        reverseIndex,
      );
      if (reverseLookup.status === "matched" && reverseLookup.registration) {
        const vehicle = lookupVehicleByRegistration(
          vehicleLookup,
          reverseLookup.registration,
        );
        result.registration = reverseLookup.registration;
        result.registrationSource = "ibus-fleet-reverse-lookup";
        result.fleetNo = vehicle?.fleetNo ?? fleetReference;
        result.bonnetNo = vehicle?.bonnetNo;
        result.operatorAgency = vehicle?.operatorAgency ?? undefined;
        result.fleetSource = "tfl-ibus-static";
        result.status = "partial";
      } else if (fleetReference) {
        result.fleetNo = fleetReference;
      }
    }

    if (!input.tripId || !input.baseVersion) {
      result.status = result.fleetSource === "tfl-ibus-static" ? "partial" : "missing-live-trip";
      result.message =
        "This live prediction does not include the trip/base-version data needed for running-number matching.";
      return result;
    }

    if (input.baseVersion !== manifest.baseVersion) {
      result.status = result.fleetSource === "tfl-ibus-static" ? "partial" : "base-version-mismatch";
      result.message = `Static iBus data needs updating. Live base version is ${input.baseVersion}; app has ${manifest.baseVersion}.`;
      return result;
    }

    const runningKey = createRunningLookupKey(input.baseVersion, input.tripId);
    const shard = await loadRunningShard(manifest, input.tripId);
    const running = shard?.[runningKey];

    if (!running) {
      result.status = result.fleetSource === "tfl-ibus-static" ? "partial" : "not-found";
      result.message = "No running-number match found for this trip.";
      return result;
    }

    result.runningNo = running.runningNo;
    result.blockNo = running.blockNo;
    result.blockIdx = running.blockIdx;
    result.garageNo = running.garageNo ?? undefined;
    result.operatorCode = running.operatorCode ?? undefined;
    result.runningNumberSource = "tfl-ibus-static";
    result.status = result.fleetSource === "tfl-ibus-static" ? "matched" : "partial";

    if (
      !result.registration &&
      vehicleLookup &&
      (fleetReference || result.fleetNo || input.vehicleId)
    ) {
      const reverseIndex = getCachedIbusVehicleReverseIndex(
        manifest.baseVersion,
        vehicleLookup,
      );
      const reverseLookup = lookupRegistrationByFleetNumber(
        vehicleLookup,
        fleetReference ?? result.fleetNo ?? input.vehicleId ?? "",
        running.operatorCode ?? undefined,
        reverseIndex,
      );
      if (reverseLookup.status === "matched" && reverseLookup.registration) {
        const vehicle = lookupVehicleByRegistration(
          vehicleLookup,
          reverseLookup.registration,
        );
        result.registration = reverseLookup.registration;
        result.registrationSource = "ibus-fleet-reverse-lookup";
        result.fleetNo = vehicle?.fleetNo ?? result.fleetNo ?? fleetReference;
        result.bonnetNo = vehicle?.bonnetNo ?? result.bonnetNo;
        result.operatorAgency = vehicle?.operatorAgency ?? result.operatorAgency;
        result.fleetSource = "tfl-ibus-static";
        result.status = "matched";
      }
    }

    if (running.garageNo) {
      const garageLookup = await loadGarageLookup(manifest);
      const garage = garageLookup?.[running.garageNo];
      if (garage) {
        result.garageCode = garage.garageCode ?? undefined;
        result.garageName = garage.garageName ?? undefined;
        if (!result.operatorCode) {
          result.operatorCode = garage.operatorCode ?? undefined;
        }
      }
    }

    if (result.status === "partial" && result.fleetSource === "none") {
      result.message = "Running number matched, but fleet number was not found in TfL iBus Vehicle data.";
    }

    return result;
  } catch {
    return {
      status: "error",
      message: "Unable to load TfL iBus static details.",
      fleetSource: "none",
      runningNumberSource: "none",
    };
  }
}
