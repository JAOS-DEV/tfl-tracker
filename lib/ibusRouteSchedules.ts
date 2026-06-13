import type { IbusCurrentManifest } from "@/lib/ibus/types";
import type { IbusRouteSchedule } from "@/lib/ibus/scheduleTypes";

const manifestCache = new Map<string, Promise<IbusCurrentManifest | null>>();
const scheduleCache = new Map<string, Promise<IbusRouteSchedule | null>>();

export function clearRouteScheduleCache(): void {
  manifestCache.clear();
  scheduleCache.clear();
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch {
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

export async function loadRouteSchedule(
  routeId: string,
  baseVersion?: string,
): Promise<IbusRouteSchedule | null> {
  const manifest = await loadIbusManifestClient();
  const version = baseVersion ?? manifest?.baseVersion;
  if (!version) {
    return null;
  }

  const cacheKey = `${version}:${routeId}`;
  const existing = scheduleCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const promise = fetchJson<IbusRouteSchedule>(
    getRouteSchedulePath(version, routeId),
  );
  scheduleCache.set(cacheKey, promise);
  return promise;
}
