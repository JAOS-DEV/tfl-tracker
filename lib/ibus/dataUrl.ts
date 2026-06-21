const LOCAL_IBUS_PREFIX = "/data/ibus";

function normalizeRelativePath(relativePath: string): string {
  return relativePath
    .replace(/^\/data\/ibus\/?/, "")
    .replace(/^\//, "");
}

export function getIbusDataBaseUrl(): string {
  return process.env.NEXT_PUBLIC_IBUS_DATA_BASE_URL?.replace(/\/$/, "") ?? "";
}

export function getIbusDataSource(): "local" | "remote" {
  return getIbusDataBaseUrl() ? "remote" : "local";
}

export function getLocalIbusDataPrefix(): string {
  return LOCAL_IBUS_PREFIX;
}

/**
 * Build a fetch URL for compact iBus static JSON.
 *
 * `relativePath` is relative to the iBus data root (not the site root), e.g.:
 * - `current.json`
 * - `20250619/route-schedules/337.json`
 * - `20250619/running-shards/017.json`
 *
 * Set `NEXT_PUBLIC_IBUS_DATA_BASE_URL` to the folder that contains `current.json`,
 * e.g. `https://cdn.example.com/data/ibus` (no trailing slash).
 *
 * When unset, falls back to `/data/ibus/...` served from the app `public/` folder.
 */
export function buildIbusDataUrl(relativePath: string): string {
  const cleaned = normalizeRelativePath(relativePath);
  const localPath = `${LOCAL_IBUS_PREFIX}/${cleaned}`;
  const remoteBase = getIbusDataBaseUrl();

  if (!remoteBase) {
    return localPath;
  }

  return `${remoteBase}/${cleaned}`;
}

export function buildIbusManifestUrl(): string {
  return buildIbusDataUrl("current.json");
}

export function buildIbusRouteScheduleUrl(
  baseVersion: string,
  routeId: string,
): string {
  return buildIbusDataUrl(`${baseVersion}/route-schedules/${routeId}.json`);
}

export function buildIbusRunningShardUrl(
  baseVersion: string,
  shard: string,
): string {
  return buildIbusDataUrl(`${baseVersion}/running-shards/${shard}.json`);
}

export function buildIbusVehicleLookupUrl(baseVersion: string): string {
  return buildIbusDataUrl(`${baseVersion}/vehicle-lookup.json`);
}

export function buildIbusGarageLookupUrl(baseVersion: string): string {
  return buildIbusDataUrl(`${baseVersion}/garage-lookup.json`);
}

export function isIbusManifestRelativePath(relativePath: string): boolean {
  return normalizeRelativePath(relativePath) === "current.json";
}

export interface IbusDataDiagnostics {
  ibusDataSource: "local" | "remote";
  ibusDataBaseUrl: string;
  manifestUrl: string;
}

export function getIbusDataDiagnostics(): IbusDataDiagnostics {
  const ibusDataBaseUrl = getIbusDataBaseUrl();
  return {
    ibusDataSource: ibusDataBaseUrl ? "remote" : "local",
    ibusDataBaseUrl: ibusDataBaseUrl || getLocalIbusDataPrefix(),
    manifestUrl: buildIbusManifestUrl(),
  };
}

export function resolveManifestPathToUrl(manifestPath: string): string {
  return buildIbusDataUrl(manifestPath);
}
