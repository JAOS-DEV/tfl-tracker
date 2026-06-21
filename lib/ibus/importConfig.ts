export type RouteScheduleMode = "none" | "selected" | "all";

export interface RouteScheduleImportConfig {
  mode: RouteScheduleMode;
  routeIds: string[];
}

export type BaseVersionImportMode = "active" | "selected" | "all";

export interface BaseVersionImportConfig {
  mode: BaseVersionImportMode;
  baseVersions: string[];
}

const ROUTE_ID_PATTERN = /^[A-Za-z0-9]+$/;

export function normalizeRouteId(routeId: string): string {
  return routeId.trim();
}

export function routeScheduleFilename(routeId: string): string {
  const normalized = normalizeRouteId(routeId);
  if (!ROUTE_ID_PATTERN.test(normalized)) {
    throw new Error(`Invalid route id for filename: ${routeId}`);
  }
  return `${normalized}.json`;
}

export function parseRouteScheduleEnv(
  value: string | undefined,
): RouteScheduleImportConfig {
  const trimmed = value?.trim();
  if (!trimmed) {
    return { mode: "none", routeIds: [] };
  }

  if (trimmed.toLowerCase() === "all") {
    return { mode: "all", routeIds: [] };
  }

  const routeIds = trimmed
    .split(",")
    .map((routeId) => normalizeRouteId(routeId))
    .filter(Boolean);

  return {
    mode: "selected",
    routeIds,
  };
}

export function parseBaseVersionsEnv(
  value: string | undefined,
): BaseVersionImportConfig {
  const explicitSingle = process.env.IBUS_BASE_VERSION?.trim();
  if (explicitSingle) {
    return { mode: "selected", baseVersions: [explicitSingle] };
  }

  const trimmed = value?.trim();
  if (!trimmed || trimmed.toLowerCase() === "active") {
    return { mode: "active", baseVersions: [] };
  }

  if (trimmed.toLowerCase() === "all") {
    return { mode: "all", baseVersions: [] };
  }

  const baseVersions = trimmed
    .split(",")
    .map((version) => version.trim())
    .filter(Boolean);

  return {
    mode: "selected",
    baseVersions,
  };
}

export function isLargeStaticImportAllowed(): boolean {
  return process.env.IBUS_ALLOW_LARGE_STATIC === "1";
}

export const STATIC_SIZE_WARN_BYTES = 500 * 1024 * 1024;
export const STATIC_SIZE_FAIL_BYTES = 1024 * 1024 * 1024;
