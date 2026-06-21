import fs from "node:fs/promises";
import path from "node:path";
import {
  fetchActiveBaseVersionFromXml,
  getIbusDataRoot,
  listLocalBaseVersions,
} from "@/lib/ibus/baseVersionDiscovery";
import type { IbusMultiVersionManifest } from "@/lib/ibus/types";

const MIN_HEALTHY_ROUTE_COUNT = 50;

export interface VerifyLocalIbusDataResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  manifestPath: string;
  activeBaseVersionFromXml: string | null;
  manifestActiveBaseVersion: string | null;
  localBaseVersions: string[];
  activeVersionRouteCount: number | null;
  remoteDataBaseUrlConfigured: boolean;
}

async function readManifest(
  manifestPath: string,
): Promise<IbusMultiVersionManifest | null> {
  try {
    const raw = await fs.readFile(manifestPath, "utf8");
    return JSON.parse(raw) as IbusMultiVersionManifest;
  } catch {
    return null;
  }
}

function routeCountForVersion(
  manifest: IbusMultiVersionManifest,
  baseVersion: string,
): number | null {
  const routes =
    manifest.routeScheduleRoutesByBaseVersion?.[baseVersion] ??
    (manifest.baseVersion === baseVersion ? manifest.routeScheduleRoutes : undefined);
  return routes?.length ?? null;
}

export async function verifyLocalIbusData(): Promise<VerifyLocalIbusDataResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const manifestPath = path.join(getIbusDataRoot(), "current.json");
  const remoteDataBaseUrlConfigured = Boolean(
    process.env.NEXT_PUBLIC_IBUS_DATA_BASE_URL?.trim(),
  );

  const manifest = await readManifest(manifestPath);
  if (!manifest) {
    errors.push(`Missing or unreadable manifest: ${manifestPath}`);
  }

  const activeBaseVersionFromXml = await fetchActiveBaseVersionFromXml().catch(
    () => null,
  );
  const manifestActiveBaseVersion = manifest?.activeBaseVersionFromXml ?? null;

  if (!manifestActiveBaseVersion) {
    errors.push("Manifest is missing activeBaseVersionFromXml.");
  }

  if (
    activeBaseVersionFromXml &&
    manifestActiveBaseVersion &&
    activeBaseVersionFromXml !== manifestActiveBaseVersion
  ) {
    warnings.push(
      `Manifest activeBaseVersionFromXml (${manifestActiveBaseVersion}) differs from live Base_Version.xml (${activeBaseVersionFromXml}). Run npm run rebuild:ibus-manifest.`,
    );
  }

  const localBaseVersions = await listLocalBaseVersions();
  const activeVersion =
    activeBaseVersionFromXml ?? manifestActiveBaseVersion ?? manifest?.baseVersion ?? null;

  if (!activeVersion) {
    errors.push("Could not determine active base version.");
  } else if (!localBaseVersions.includes(activeVersion)) {
    errors.push(
      `Active base version ${activeVersion} is not imported locally. Run npm run import:ibus:active.`,
    );
  }

  let activeVersionRouteCount: number | null = null;
  if (manifest && activeVersion) {
    activeVersionRouteCount = routeCountForVersion(manifest, activeVersion);
    if (activeVersionRouteCount === null || activeVersionRouteCount === 0) {
      errors.push(
        `Active version ${activeVersion} has no route schedules in the manifest.`,
      );
    } else if (activeVersionRouteCount < MIN_HEALTHY_ROUTE_COUNT) {
      warnings.push(
        `Active version ${activeVersion} only lists ${activeVersionRouteCount} routes (expected hundreds for an all-route import).`,
      );
    }
  }

  if (localBaseVersions.length > 2) {
    warnings.push(
      `${localBaseVersions.length} local baseVersion folders found (${localBaseVersions.join(", ")}). The free workflow keeps one active version; remove old folders to keep the repo smaller.`,
    );
  }

  if (remoteDataBaseUrlConfigured) {
    warnings.push(
      "NEXT_PUBLIC_IBUS_DATA_BASE_URL is set. Local verification assumes compact data is served from public/data/ibus/. Unset the env var for the free local workflow.",
    );
  }

  if (
    activeBaseVersionFromXml &&
    manifest?.availableBaseVersions &&
    !manifest.availableBaseVersions.includes(activeBaseVersionFromXml)
  ) {
    errors.push(
      `Active base version ${activeBaseVersionFromXml} is not listed in manifest availableBaseVersions.`,
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    manifestPath,
    activeBaseVersionFromXml,
    manifestActiveBaseVersion,
    localBaseVersions,
    activeVersionRouteCount,
    remoteDataBaseUrlConfigured,
  };
}
