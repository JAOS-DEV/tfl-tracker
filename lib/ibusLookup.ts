import {
  createRunningLookupKey,
  runningShardForTripId,
} from "@/lib/ibus/keys";
import type {
  IbusDetailsResult,
  IbusGarageRecord,
  IbusMultiVersionManifest,
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
import { fetchIbusJson } from "@/lib/ibus/fetchIbusJson";
import { resolveStaticBaseVersionForLookup } from "@/lib/ibus/baseVersionSelection";
import { extractVehicleRegistration } from "@/lib/vehicles/registration";
import { extractVehicleFleetReference } from "@/lib/vehicles/lookupKey";

const manifestCache = {
  promise: null as Promise<IbusMultiVersionManifest | null> | null,
  value: null as IbusMultiVersionManifest | null,
  loadedFrom: null as string | null,
};

const vehicleLookupCache = new Map<string, Promise<Record<string, IbusVehicleRecord> | null>>();
const garageLookupCache = new Map<string, Promise<Record<string, IbusGarageRecord> | null>>();
const runningShardCache = new Map<string, Promise<Record<string, IbusRunningRecord> | null>>();

export type VehicleLookupStatus = "matched" | "not-found" | "not-loaded";
export type RunningLookupStatus =
  | "matched"
  | "not-found"
  | "static-trip-not-found-live-version-differs"
  | "shard-not-loaded"
  | "not-requested"
  | "not-loaded";

export const RUNNING_LOOKUP_NOTE_MATCHED_VERSION_DIFFERS =
  "Live prediction reports a different baseVersion, but tripId matched current static iBus data.";
export const RUNNING_LOOKUP_NOTE_NOT_FOUND_VERSION_DIFFERS =
  "TripId was not found in current static iBus data; live prediction reports a different baseVersion.";

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
  vehicleLookupStatus?: VehicleLookupStatus;
  vehicleLookupSource?: "tfl-ibus-static";
  runningLookupStatus?: RunningLookupStatus;
  runningLookupNote?: string;
  runningLookupFailureReason?: string;
  liveBaseVersion?: string;
  staticBaseVersion?: string;
  routeScheduleBaseVersion?: string;
  runningShardBaseVersion?: string;
  runningLookupShardId?: string;
  runningLookupAttempted?: boolean;
  runningLookupKey?: string;
  baseVersionMatches?: boolean;
}

export async function loadIbusManifest(): Promise<IbusMultiVersionManifest | null> {
  if (manifestCache.value) {
    return manifestCache.value;
  }

  manifestCache.promise ??= fetchIbusJson<IbusMultiVersionManifest>("current.json", {
    trackAs: "manifest",
  }).then(({ data, loadedFrom }) => {
    manifestCache.loadedFrom = loadedFrom;
    return data;
  });
  const manifest = await manifestCache.promise;
  manifestCache.value = manifest;
  return manifest;
}

export function getIbusManifestLoadedFrom(): string | null {
  return manifestCache.loadedFrom;
}

export function clearIbusLookupCache(): void {
  manifestCache.promise = null;
  manifestCache.value = null;
  manifestCache.loadedFrom = null;
  vehicleLookupCache.clear();
  garageLookupCache.clear();
  runningShardCache.clear();
  clearIbusVehicleReverseIndexCache();
}

export function normalizeLiveBaseVersion(
  baseVersion: string | undefined,
): string | undefined {
  const normalized = baseVersion?.trim();
  return normalized ? normalized : undefined;
}

export function liveBaseVersionMatchesStatic(
  liveBaseVersion: string | undefined,
  staticBaseVersion: string,
): boolean {
  const normalizedLive = normalizeLiveBaseVersion(liveBaseVersion);
  return Boolean(normalizedLive && normalizedLive === staticBaseVersion.trim());
}

async function loadRunningShard(
  baseVersion: string,
  tripId: string,
): Promise<Record<string, IbusRunningRecord> | null> {
  const shard = runningShardForTripId(tripId);
  const cacheKey = `${baseVersion}:${shard}`;
  const cached = runningShardCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const relativePath = `${baseVersion}/running-shards/${shard}.json`;
  const promise = fetchIbusJson<Record<string, IbusRunningRecord>>(relativePath, {
    trackAs: "runningShard",
  }).then(({ data }) => data);
  runningShardCache.set(cacheKey, promise);
  return promise;
}

async function loadVehicleLookupForVersion(
  baseVersion: string,
): Promise<Record<string, IbusVehicleRecord> | null> {
  const cached = vehicleLookupCache.get(baseVersion);
  if (cached) {
    return cached;
  }

  const promise = fetchIbusJson<Record<string, IbusVehicleRecord>>(
    `${baseVersion}/vehicle-lookup.json`,
    { trackAs: "vehicleLookup" },
  ).then(({ data }) => data);
  vehicleLookupCache.set(baseVersion, promise);
  return promise;
}

async function loadGarageLookupForVersion(
  baseVersion: string,
): Promise<Record<string, IbusGarageRecord> | null> {
  const cached = garageLookupCache.get(baseVersion);
  if (cached) {
    return cached;
  }

  const promise = fetchIbusJson<Record<string, IbusGarageRecord>>(
    `${baseVersion}/garage-lookup.json`,
    { trackAs: "garageLookup" },
  ).then(({ data }) => data);
  garageLookupCache.set(baseVersion, promise);
  return promise;
}

function mergeRunningDetail(
  existing: LiveIbusRunningDetail | undefined,
  patch: LiveIbusRunningDetail,
): LiveIbusRunningDetail {
  return {
    ...existing,
    ...patch,
    ...(existing?.registration && !patch.registration
      ? { registration: existing.registration }
      : {}),
    ...(existing?.registrationSource && !patch.registrationSource
      ? { registrationSource: existing.registrationSource }
      : {}),
    ...(existing?.registrationLookupStatus && !patch.registrationLookupStatus
      ? { registrationLookupStatus: existing.registrationLookupStatus }
      : {}),
  };
}

function enrichRegistrationFromVehicleLookup(
  prediction: IbusPredictionInput,
  existing: LiveIbusRunningDetail | undefined,
  vehicleLookup: Record<string, IbusVehicleRecord>,
  reverseIndex: ReturnType<typeof getCachedIbusVehicleReverseIndex>,
  staticBaseVersion: string,
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
    return mergeRunningDetail(existing, {
      staticBaseVersion,
      liveBaseVersion: normalizeLiveBaseVersion(prediction.baseVersion),
      vehicleLookupStatus: vehicle ? "matched" : "not-found",
      vehicleLookupSource: "tfl-ibus-static",
      registration: liveRegistration,
      registrationSource: "live-tfl-prediction",
      registrationLookupStatus: vehicle ? "matched" : "not-found",
      ...(vehicle?.fleetNo ? { fleetNo: vehicle.fleetNo } : {}),
    });
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
    return mergeRunningDetail(existing, {
      staticBaseVersion,
      liveBaseVersion: normalizeLiveBaseVersion(prediction.baseVersion),
      vehicleLookupStatus: "matched",
      vehicleLookupSource: "tfl-ibus-static",
      registration: reverseLookup.registration,
      registrationSource: "ibus-fleet-reverse-lookup",
      registrationLookupStatus: "matched",
      fleetNo: vehicle?.fleetNo ?? fleetCandidate,
    });
  }

  if (reverseLookup.status === "ambiguous") {
    return mergeRunningDetail(existing, {
      staticBaseVersion,
      liveBaseVersion: normalizeLiveBaseVersion(prediction.baseVersion),
      vehicleLookupStatus: "not-found",
      vehicleLookupSource: "tfl-ibus-static",
      registrationLookupStatus: "ambiguous",
      ...(fleetReference || existing?.fleetNo
        ? { fleetNo: existing?.fleetNo ?? fleetReference }
        : {}),
    });
  }

  return mergeRunningDetail(existing, {
    staticBaseVersion,
    liveBaseVersion: normalizeLiveBaseVersion(prediction.baseVersion),
    vehicleLookupStatus: fleetCandidate ? "not-found" : "not-loaded",
    vehicleLookupSource: "tfl-ibus-static",
    registrationLookupStatus: fleetCandidate ? "not-found" : "not-needed",
    ...(fleetReference || existing?.fleetNo
      ? { fleetNo: existing?.fleetNo ?? fleetReference }
      : {}),
  });
}

export async function resolveLiveRunningDetailsForPredictions(
  predictions: IbusPredictionInput[],
  options?: {
    routeScheduleBaseVersion?: string;
    selectedBaseVersion?: string;
  },
): Promise<Map<string, LiveIbusRunningDetail>> {
  const manifest = await loadIbusManifest();
  const result = new Map<string, LiveIbusRunningDetail>();

  if (!manifest) {
    for (const prediction of predictions) {
      const vehicleKey = prediction.vehicleId;
      if (!vehicleKey) {
        continue;
      }
      result.set(vehicleKey, {
        vehicleLookupStatus: "not-loaded",
        runningLookupStatus: "not-loaded",
        runningLookupAttempted: Boolean(prediction.tripId),
      });
    }
    return result;
  }

  const liveBaseVersionHint = predictions
    .map((prediction) => normalizeLiveBaseVersion(prediction.baseVersion))
    .find(
      (version) =>
        version &&
        manifest.availableBaseVersions?.includes(version),
    );

  const staticBaseVersion = resolveStaticBaseVersionForLookup(manifest, {
    selectedBaseVersion: options?.selectedBaseVersion,
    routeScheduleBaseVersion: options?.routeScheduleBaseVersion,
    liveBaseVersion: liveBaseVersionHint,
  });
  const shardEntries = new Map<
    string,
    Array<{ vehicleKey: string; lookupKey: string; tripId: string }>
  >();

  for (const prediction of predictions) {
    const vehicleKey = prediction.vehicleId;
    if (!vehicleKey) {
      continue;
    }

    const liveBaseVersion = normalizeLiveBaseVersion(prediction.baseVersion);
    const baseVersionMatches = liveBaseVersionMatchesStatic(
      liveBaseVersion,
      staticBaseVersion,
    );
    const runningLookupAttempted = Boolean(prediction.tripId);

    result.set(vehicleKey, {
      liveBaseVersion,
      staticBaseVersion,
      routeScheduleBaseVersion: options?.routeScheduleBaseVersion,
      runningShardBaseVersion: staticBaseVersion,
      runningLookupAttempted,
      baseVersionMatches,
      runningLookupStatus: runningLookupAttempted ? undefined : "not-requested",
      runningLookupFailureReason: !runningLookupAttempted
        ? "Live prediction has no tripId for running lookup"
        : undefined,
    });

    if (!prediction.tripId) {
      continue;
    }

    const shard = runningShardForTripId(prediction.tripId);
    const lookupKey = createRunningLookupKey(staticBaseVersion, prediction.tripId);
    const existing = shardEntries.get(shard) ?? [];
    existing.push({ vehicleKey, lookupKey, tripId: prediction.tripId });
    shardEntries.set(shard, existing);
  }

  for (const [shard, entries] of shardEntries.entries()) {
    const sampleTripId = entries[0]?.tripId;
    if (!sampleTripId) {
      continue;
    }

    const shardData = await loadRunningShard(staticBaseVersion, sampleTripId);
    for (const entry of entries) {
      const current = result.get(entry.vehicleKey) ?? {};
      const liveBaseVersion = current.liveBaseVersion;
      const baseVersionMatches = liveBaseVersionMatchesStatic(
        liveBaseVersion,
        staticBaseVersion,
      );

      if (!shardData) {
        result.set(entry.vehicleKey, mergeRunningDetail(current, {
          runningLookupStatus: "shard-not-loaded",
          runningLookupShardId: shard,
          runningLookupKey: entry.lookupKey,
          runningLookupFailureReason: `Running shard ${shard} could not be loaded`,
          baseVersionMatches,
        }));
        continue;
      }

      const running = shardData[entry.lookupKey];
      if (!running?.runningNo) {
        result.set(entry.vehicleKey, mergeRunningDetail(current, {
          runningLookupStatus: baseVersionMatches
            ? "not-found"
            : "static-trip-not-found-live-version-differs",
          runningLookupShardId: shard,
          runningLookupKey: entry.lookupKey,
          runningLookupNote: baseVersionMatches
            ? undefined
            : RUNNING_LOOKUP_NOTE_NOT_FOUND_VERSION_DIFFERS,
          runningLookupFailureReason: baseVersionMatches
            ? `TripId ${entry.tripId} not found in static running shard ${shard}`
            : `TripId ${entry.tripId} not found under static key ${entry.lookupKey}`,
        }));
        continue;
      }

      result.set(entry.vehicleKey, mergeRunningDetail(current, {
        runningNo: running.runningNo,
        blockNo: running.blockNo,
        operatorCode: running.operatorCode ?? undefined,
        runningLookupStatus: "matched",
        runningLookupShardId: shard,
        runningLookupKey: entry.lookupKey,
        runningLookupNote: baseVersionMatches
          ? undefined
          : RUNNING_LOOKUP_NOTE_MATCHED_VERSION_DIFFERS,
        runningLookupFailureReason: undefined,
        baseVersionMatches,
      }));
    }
  }

  const vehicleLookup = await loadVehicleLookupForVersion(staticBaseVersion);
  if (!vehicleLookup) {
    for (const [vehicleKey, detail] of result.entries()) {
      result.set(vehicleKey, {
        ...detail,
        vehicleLookupStatus: detail.vehicleLookupStatus ?? "not-loaded",
      });
    }
    return result;
  }

  const reverseIndex = getCachedIbusVehicleReverseIndex(
    staticBaseVersion,
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
      staticBaseVersion,
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
    const liveBaseVersion = normalizeLiveBaseVersion(input.baseVersion);
    const staticBaseVersion = resolveStaticBaseVersionForLookup(manifest, {
      liveBaseVersion,
    });
    const baseVersionMatches = liveBaseVersionMatchesStatic(
      liveBaseVersion,
      staticBaseVersion,
    );

    const result: IbusDetailsResult = {
      registration: liveRegistration,
      registrationSource: liveRegistration ? "live-tfl-prediction" : undefined,
      sourceBaseVersion: staticBaseVersion,
      fleetSource: "none",
      runningNumberSource: "none",
      status: "not-found",
    };

    const vehicleLookup = await loadVehicleLookupForVersion(staticBaseVersion);

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
        staticBaseVersion,
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

    const runningKey = createRunningLookupKey(staticBaseVersion, input.tripId);
    const shard = await loadRunningShard(staticBaseVersion, input.tripId);
    const running = shard?.[runningKey];

    if (!running) {
      result.status = result.fleetSource === "tfl-ibus-static" ? "partial" : "not-found";
      result.message = baseVersionMatches
        ? "No running-number match found for this trip."
        : RUNNING_LOOKUP_NOTE_NOT_FOUND_VERSION_DIFFERS;
      return result;
    }

    result.runningNo = running.runningNo;
    result.blockNo = running.blockNo;
    result.blockIdx = running.blockIdx;
    result.garageNo = running.garageNo ?? undefined;
    result.operatorCode = running.operatorCode ?? undefined;
    result.runningNumberSource = "tfl-ibus-static";
    result.status = result.fleetSource === "tfl-ibus-static" ? "matched" : "partial";
    if (!baseVersionMatches) {
      result.message = RUNNING_LOOKUP_NOTE_MATCHED_VERSION_DIFFERS;
    }

    if (
      !result.registration &&
      vehicleLookup &&
      (fleetReference || result.fleetNo || input.vehicleId)
    ) {
      const reverseIndex = getCachedIbusVehicleReverseIndex(
        staticBaseVersion,
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
      const garageLookup = await loadGarageLookupForVersion(staticBaseVersion);
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
