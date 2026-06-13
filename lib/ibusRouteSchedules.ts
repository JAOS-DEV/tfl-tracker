import type { IbusCurrentManifest } from "@/lib/ibus/types";
import type { IbusRouteSchedule } from "@/lib/ibus/scheduleTypes";

const manifestCache = new Map<string, Promise<IbusCurrentManifest | null>>();
const scheduleCache = new Map<string, Promise<IbusRouteSchedule | null>>();
const missingScheduleRoutes = new Set<string>();

export function clearRouteScheduleCache(): void {
  manifestCache.clear();
  scheduleCache.clear();
  missingScheduleRoutes.clear();
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
  return manifest.routeScheduleRoutes.includes(routeId);
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

  const promise = fetchJson<IbusRouteSchedule>(
    getRouteSchedulePath(version, routeId),
  ).then((schedule) => {
    if (!schedule) {
      missingScheduleRoutes.add(cacheKey);
    }
    return schedule;
  });
  scheduleCache.set(cacheKey, promise);
  return promise;
}
