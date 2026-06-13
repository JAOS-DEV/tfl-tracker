import type { IbusCurrentManifest } from "@/lib/ibus/types";
import type { IbusRouteSchedule } from "@/lib/ibus/scheduleTypes";
import { normalizeRouteSchedule } from "@/lib/ibus/compactScheduleDecode";

const manifestCache = new Map<string, Promise<IbusCurrentManifest | null>>();
const scheduleCache = new Map<string, Promise<IbusRouteSchedule | null>>();
const missingScheduleRoutes = new Set<string>();
let routeAvailabilityCache = new WeakMap<IbusCurrentManifest, Set<string>>();

export function clearRouteScheduleCache(): void {
  manifestCache.clear();
  scheduleCache.clear();
  missingScheduleRoutes.clear();
  routeAvailabilityCache = new WeakMap<IbusCurrentManifest, Set<string>>();
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      if (response.status === 404 && process.env.NODE_ENV === "development") {
        console.debug(`Route schedule not found (expected): ${path}`);
      }
      return null;
    }
    return (await response.json()) as T;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.debug("Route schedule fetch failed:", path, error);
    }
    return null;
  }
}

export async function loadIbusManifestClient(): Promise<IbusCurrentManifest | null> {
  const cacheKey = "current";
  const existing = manifestCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const promise = fetchJson<IbusCurrentManifest>("/data/ibus/current.json");
  manifestCache.set(cacheKey, promise);
  return promise;
}

export function getRouteSchedulePath(
  baseVersion: string,
  routeId: string,
): string {
  return `/data/ibus/${baseVersion}/route-schedules/${routeId}.json`;
}

export function isRouteScheduleAvailable(
  manifest: IbusCurrentManifest | null | undefined,
  routeId: string,
): boolean {
  if (!manifest?.routeScheduleRoutes) {
    return true;
  }

  let routeSet = routeAvailabilityCache.get(manifest);
  if (!routeSet) {
    routeSet = new Set(manifest.routeScheduleRoutes);
    routeAvailabilityCache.set(manifest, routeSet);
  }

  return routeSet.has(routeId);
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

export async function loadRouteSchedule(
  routeId: string,
  baseVersion?: string,
): Promise<IbusRouteSchedule | null> {
  const manifest = await loadIbusManifestClient();
  const version = baseVersion ?? manifest?.baseVersion;
  if (!version) {
    return null;
  }

  if (manifest && !isRouteScheduleAvailable(manifest, routeId)) {
    missingScheduleRoutes.add(`${version}:${routeId}`);
    return null;
  }

  const cacheKey = `${version}:${routeId}`;
  if (missingScheduleRoutes.has(cacheKey)) {
    return null;
  }

  const existing = scheduleCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const startedAt = markScheduleStart(cacheKey);
  const promise = fetchJson<unknown>(
    getRouteSchedulePath(version, routeId),
  ).then((raw) => {
    const schedule = normalizeRouteSchedule(raw);
    if (!schedule) {
      missingScheduleRoutes.add(cacheKey);
    }
    measureScheduleLoad(cacheKey, startedAt);
    return schedule;
  });
  scheduleCache.set(cacheKey, promise);
  return promise;
}
