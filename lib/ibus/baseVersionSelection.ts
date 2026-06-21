import {
  buildIbusGarageLookupUrl,
  buildIbusRunningShardUrl,
  buildIbusVehicleLookupUrl,
} from "@/lib/ibus/dataUrl";
import type { IbusMultiVersionManifest } from "@/lib/ibus/types";

export type BaseVersionSelectionReason =
  | "live-version-local-match"
  | "active-version-local-match"
  | "latest-local-fallback"
  | "no-local-version";

function normalizeLiveBaseVersion(
  baseVersion: string | undefined,
): string | undefined {
  const normalized = baseVersion?.trim();
  return normalized ? normalized : undefined;
}

function availableBaseVersionsForManifest(
  manifest: IbusMultiVersionManifest,
): string[] {
  if (manifest.availableBaseVersions && manifest.availableBaseVersions.length > 0) {
    return manifest.availableBaseVersions;
  }
  return manifest.baseVersion ? [manifest.baseVersion] : [];
}

/** Pick a static iBus version that actually exists locally (or in the manifest list). */
export function resolveStaticBaseVersionForLookup(
  manifest: IbusMultiVersionManifest,
  options?: {
    selectedBaseVersion?: string;
    routeScheduleBaseVersion?: string;
    liveBaseVersion?: string;
  },
): string {
  const available = availableBaseVersionsForManifest(manifest);

  const pickIfAvailable = (
    version: string | undefined,
  ): string | undefined => {
    const normalized = normalizeLiveBaseVersion(version);
    if (normalized && available.includes(normalized)) {
      return normalized;
    }
    return undefined;
  };

  return (
    pickIfAvailable(options?.selectedBaseVersion) ??
    pickIfAvailable(options?.routeScheduleBaseVersion) ??
    pickIfAvailable(options?.liveBaseVersion) ??
    pickIfAvailable(manifest.activeBaseVersionFromXml) ??
    [...available].sort().at(-1) ??
    manifest.baseVersion
  );
}

export interface BaseVersionSelectionResult {
  liveBaseVersion?: string;
  activeBaseVersionFromXml?: string;
  selectedBaseVersion: string | null;
  selectedBecause: BaseVersionSelectionReason;
  availableLocalVersionsForRoute: string[];
  lookupAttemptedKeys: string[];
}

function routeVersionsForManifest(
  manifest: IbusMultiVersionManifest,
  routeId: string,
): string[] {
  const versions =
    manifest.availableBaseVersions && manifest.availableBaseVersions.length > 0
      ? manifest.availableBaseVersions
      : [manifest.baseVersion];
  const byVersion = manifest.routeScheduleRoutesByBaseVersion ?? {};
  const result: string[] = [];

  for (const baseVersion of versions) {
    const routes = byVersion[baseVersion] ?? manifest.routeScheduleRoutes;
    if (!routes || routes.includes(routeId)) {
      result.push(baseVersion);
    }
  }

  if (result.length === 0 && manifest.routeScheduleRoutes?.includes(routeId)) {
    return [manifest.baseVersion];
  }

  return result.sort();
}

function hasRouteForVersion(
  manifest: IbusMultiVersionManifest,
  routeId: string,
  baseVersion: string,
): boolean {
  const routes =
    manifest.routeScheduleRoutesByBaseVersion?.[baseVersion] ??
    (manifest.baseVersion === baseVersion
      ? manifest.routeScheduleRoutes
      : undefined);
  if (!routes) {
    return false;
  }
  return routes.includes(routeId);
}

export function selectBaseVersionForRoute(input: {
  routeId: string;
  liveBaseVersion?: string;
  manifest: IbusMultiVersionManifest | null;
}): BaseVersionSelectionResult {
  const liveBaseVersion = normalizeLiveBaseVersion(input.liveBaseVersion);
  const activeBaseVersionFromXml = input.manifest?.activeBaseVersionFromXml;
  const availableLocalVersionsForRoute = input.manifest
    ? routeVersionsForManifest(input.manifest, input.routeId)
    : [];

  const lookupAttemptedKeys: string[] = [];
  if (liveBaseVersion) {
    lookupAttemptedKeys.push(`${liveBaseVersion}:${input.routeId}`);
  }
  if (activeBaseVersionFromXml) {
    lookupAttemptedKeys.push(`${activeBaseVersionFromXml}:${input.routeId}`);
  }
  for (const version of [...availableLocalVersionsForRoute].reverse()) {
    lookupAttemptedKeys.push(`${version}:${input.routeId}`);
  }

  if (!input.manifest) {
    return {
      liveBaseVersion,
      activeBaseVersionFromXml,
      selectedBaseVersion: null,
      selectedBecause: "no-local-version",
      availableLocalVersionsForRoute,
      lookupAttemptedKeys,
    };
  }

  if (
    liveBaseVersion &&
    hasRouteForVersion(input.manifest, input.routeId, liveBaseVersion)
  ) {
    return {
      liveBaseVersion,
      activeBaseVersionFromXml,
      selectedBaseVersion: liveBaseVersion,
      selectedBecause: "live-version-local-match",
      availableLocalVersionsForRoute,
      lookupAttemptedKeys,
    };
  }

  if (
    activeBaseVersionFromXml &&
    hasRouteForVersion(input.manifest, input.routeId, activeBaseVersionFromXml)
  ) {
    return {
      liveBaseVersion,
      activeBaseVersionFromXml,
      selectedBaseVersion: activeBaseVersionFromXml,
      selectedBecause: "active-version-local-match",
      availableLocalVersionsForRoute,
      lookupAttemptedKeys,
    };
  }

  const latestFallback = [...availableLocalVersionsForRoute].sort().at(-1) ?? null;
  if (latestFallback) {
    return {
      liveBaseVersion,
      activeBaseVersionFromXml,
      selectedBaseVersion: latestFallback,
      selectedBecause: "latest-local-fallback",
      availableLocalVersionsForRoute,
      lookupAttemptedKeys,
    };
  }

  return {
    liveBaseVersion,
    activeBaseVersionFromXml,
    selectedBaseVersion: null,
    selectedBecause: "no-local-version",
    availableLocalVersionsForRoute,
    lookupAttemptedKeys,
  };
}

export function getRunningShardPathTemplate(
  baseVersion: string,
): string {
  return buildIbusRunningShardUrl(baseVersion, "{shard}");
}

export function getVehicleLookupPath(baseVersion: string): string {
  return buildIbusVehicleLookupUrl(baseVersion);
}

export function getGarageLookupPath(baseVersion: string): string {
  return buildIbusGarageLookupUrl(baseVersion);
}

export function isMultiVersionManifest(
  manifest: IbusMultiVersionManifest | null | undefined,
): manifest is IbusMultiVersionManifest {
  return Boolean(
    manifest?.availableBaseVersions && manifest.availableBaseVersions.length > 0,
  );
}
