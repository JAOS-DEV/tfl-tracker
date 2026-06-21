import { buildIbusRouteScheduleUrl } from "@/lib/ibus/dataUrl";
import {
  clearIbusFetchDiagnostics,
  fetchIbusJson,
} from "@/lib/ibus/fetchIbusJson";
import type { IbusMultiVersionManifest } from "@/lib/ibus/types";
import type { IbusRouteSchedule } from "@/lib/ibus/scheduleTypes";
import { normalizeRouteSchedule } from "@/lib/ibus/compactScheduleDecode";
import {
  selectBaseVersionForRoute,
  type BaseVersionSelectionResult,
} from "@/lib/ibus/baseVersionSelection";

const manifestCache = new Map<string, Promise<IbusMultiVersionManifest | null>>();
const scheduleCache = new Map<string, Promise<IbusRouteSchedule | null>>();
const missingScheduleRoutes = new Set<string>();
let routeAvailabilityCache = new WeakMap<
  IbusMultiVersionManifest,
  Map<string, Set<string>>
>();

export function clearRouteScheduleCache(): void {
  manifestCache.clear();
  scheduleCache.clear();
  missingScheduleRoutes.clear();
  routeAvailabilityCache = new WeakMap();
  clearIbusFetchDiagnostics();
}

export async function loadIbusManifestClient(): Promise<IbusMultiVersionManifest | null> {
  const cacheKey = "current";
  const existing = manifestCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const promise = fetchIbusJson<IbusMultiVersionManifest>("current.json", {
    trackAs: "manifest",
  }).then(({ data }) => data);
  manifestCache.set(cacheKey, promise);
  return promise;
}

export function getRouteSchedulePath(
  baseVersion: string,
  routeId: string,
): string {
  return buildIbusRouteScheduleUrl(baseVersion, routeId);
}

export function getRouteScheduleRelativePath(
  baseVersion: string,
  routeId: string,
): string {
  return `${baseVersion}/route-schedules/${routeId}.json`;
}

function getRouteSetForVersion(
  manifest: IbusMultiVersionManifest,
  baseVersion: string,
): Set<string> | null {
  let versionCache = routeAvailabilityCache.get(manifest);
  if (!versionCache) {
    versionCache = new Map();
    routeAvailabilityCache.set(manifest, versionCache);
  }

  const cached = versionCache.get(baseVersion);
  if (cached) {
    return cached;
  }

  const routes =
    manifest.routeScheduleRoutesByBaseVersion?.[baseVersion] ??
    (manifest.baseVersion === baseVersion
      ? manifest.routeScheduleRoutes
      : undefined);
  if (!routes) {
    return null;
  }

  const routeSet = new Set(routes);
  versionCache.set(baseVersion, routeSet);
  return routeSet;
}

export function isRouteScheduleAvailable(
  manifest: IbusMultiVersionManifest | null | undefined,
  routeId: string,
  baseVersion?: string,
): boolean {
  if (!manifest) {
    return false;
  }

  const version = baseVersion ?? manifest.baseVersion;
  const routeSet = getRouteSetForVersion(manifest, version);
  if (!routeSet) {
    return manifest.routeScheduleRoutes === undefined;
  }

  return routeSet.has(routeId);
}

export function resolveRouteScheduleSelection(
  routeId: string,
  manifest: IbusMultiVersionManifest | null,
  liveBaseVersion?: string,
): BaseVersionSelectionResult {
  return selectBaseVersionForRoute({
    routeId,
    liveBaseVersion,
    manifest,
  });
}

function markScheduleStart(cacheKey: string): number {
  if (process.env.NODE_ENV !== "development" || typeof performance === "undefined") {
    return 0;
  }
  performance.mark(`route-schedule:${cacheKey}:start`);
  return performance.now();
}

function measureScheduleLoad(cacheKey: string, startedAt: number): void {
  if (
    process.env.NODE_ENV !== "development" ||
    typeof performance === "undefined" ||
    startedAt === 0
  ) {
    return;
  }

  performance.mark(`route-schedule:${cacheKey}:end`);
  performance.measure(
    `route-schedule:${cacheKey}`,
    `route-schedule:${cacheKey}:start`,
    `route-schedule:${cacheKey}:end`,
  );
  console.debug(
    `Route schedule ${cacheKey} fetched/decoded in ${Math.round(
      performance.now() - startedAt,
    )}ms`,
  );
}

export interface LoadRouteScheduleOptions {
  liveBaseVersion?: string;
  selectedBaseVersion?: string;
}

export async function loadRouteSchedule(
  routeId: string,
  options: LoadRouteScheduleOptions = {},
): Promise<{
  schedule: IbusRouteSchedule | null;
  selection: BaseVersionSelectionResult;
}> {
  const manifest = await loadIbusManifestClient();
  const selection = resolveRouteScheduleSelection(
    routeId,
    manifest,
    options.liveBaseVersion,
  );

  const version =
    options.selectedBaseVersion ?? selection.selectedBaseVersion;
  if (!version) {
    return { schedule: null, selection };
  }

  if (manifest && !isRouteScheduleAvailable(manifest, routeId, version)) {
    missingScheduleRoutes.add(`${version}:${routeId}`);
    return {
      schedule: null,
      selection: {
        ...selection,
        selectedBaseVersion: null,
        selectedBecause: "no-local-version",
      },
    };
  }

  const cacheKey = `${version}:${routeId}`;
  if (missingScheduleRoutes.has(cacheKey)) {
    return { schedule: null, selection: { ...selection, selectedBaseVersion: version } };
  }

  const existing = scheduleCache.get(cacheKey);
  if (existing) {
    const schedule = await existing;
    return {
      schedule,
      selection: { ...selection, selectedBaseVersion: version },
    };
  }

  const startedAt = markScheduleStart(cacheKey);
  const relativePath = getRouteScheduleRelativePath(version, routeId);
  const promise = fetchIbusJson<unknown>(relativePath, {
    trackAs: "routeSchedule",
  }).then(({ data: raw }) => {
    const schedule = normalizeRouteSchedule(raw);
    if (!schedule) {
      missingScheduleRoutes.add(cacheKey);
    }
    measureScheduleLoad(cacheKey, startedAt);
    return schedule;
  });
  scheduleCache.set(cacheKey, promise);

  const schedule = await promise;
  return {
    schedule,
    selection: { ...selection, selectedBaseVersion: version },
  };
}
