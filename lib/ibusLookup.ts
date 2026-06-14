import {
  createRunningLookupKey,
  normalizeIbusRegistration,
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
import { extractVehicleRegistration } from "@/lib/vehicles/registration";

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
      });
    }
  }

  const vehicleLookup = await loadVehicleLookup(manifest);
  if (!vehicleLookup) {
    return result;
  }

  for (const prediction of predictions) {
    const vehicleKey = prediction.vehicleId;
    if (!vehicleKey) {
      continue;
    }

    const registration =
      extractVehicleRegistration(vehicleKey) ??
      normalizeIbusRegistration(vehicleKey);
    if (!registration) {
      continue;
    }

    const fleetNo = vehicleLookup[registration]?.fleetNo;
    if (!fleetNo) {
      continue;
    }

    const existing = result.get(vehicleKey);
    result.set(vehicleKey, {
      ...existing,
      fleetNo,
    });
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

    const registration =
      extractVehicleRegistration(input.vehicleId) ??
      (input.vehicleId
        ? normalizeIbusRegistration(input.vehicleId)
        : undefined);

    const result: IbusDetailsResult = {
      registration,
      sourceBaseVersion: manifest.baseVersion,
      fleetSource: "none",
      runningNumberSource: "none",
      status: "not-found",
    };

    if (registration) {
      const vehicleLookup = await loadVehicleLookup(manifest);
      const vehicle = vehicleLookup?.[registration];
      if (vehicle) {
        result.fleetNo = vehicle.fleetNo;
        result.bonnetNo = vehicle.bonnetNo;
        result.operatorAgency = vehicle.operatorAgency ?? undefined;
        result.fleetSource = "tfl-ibus-static";
        result.status = "partial";
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
