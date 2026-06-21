import fs from "node:fs/promises";
import path from "node:path";
import { parseBaseVersionXml } from "@/lib/ibus/baseVersion";
import { fetchIbusText, IBUS_ROOT, resolveIbusDownloadUrls } from "@/lib/ibus/download";

/** Known public iBus base version folders (seed list for remote probing). */
export const KNOWN_IBUS_BASE_VERSION_SEEDS = [
  "20250619",
  "20260117",
  "20260130",
  "20260214",
  "20260227",
  "20260313",
  "20260328",
  "20260411",
  "20260424",
  "20260509",
  "20260522",
  "20260606",
] as const;

const BASE_VERSION_PATTERN = /^\d{8}$/;

export function isValidBaseVersionId(value: string): boolean {
  return BASE_VERSION_PATTERN.test(value.trim());
}

export async function fetchActiveBaseVersionFromXml(): Promise<string> {
  const xml = await fetchIbusText(
    `${IBUS_ROOT}/Base_Version.xml`,
    "Base_Version.xml",
  );
  return parseBaseVersionXml(xml);
}

export async function probeRemoteBaseVersion(
  baseVersion: string,
): Promise<boolean> {
  if (!isValidBaseVersionId(baseVersion)) {
    return false;
  }

  const urls = resolveIbusDownloadUrls(baseVersion);
  try {
    const response = await fetch(urls.vehicleZip, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

export async function discoverRemoteBaseVersions(
  seeds: string[] = [...KNOWN_IBUS_BASE_VERSION_SEEDS],
): Promise<string[]> {
  const active = await fetchActiveBaseVersionFromXml().catch(() => null);
  const candidates = new Set<string>(
    seeds.filter(isValidBaseVersionId).map((value) => value.trim()),
  );
  if (active) {
    candidates.add(active);
  }

  const discovered: string[] = [];
  for (const version of [...candidates].sort()) {
    if (await probeRemoteBaseVersion(version)) {
      discovered.push(version);
    }
  }

  return discovered;
}

export function getIbusDataRoot(): string {
  return path.join("public", "data", "ibus");
}

export async function listLocalBaseVersions(
  ibusRoot = getIbusDataRoot(),
): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(ibusRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  return entries
    .filter((entry) => entry.isDirectory() && isValidBaseVersionId(entry.name))
    .map((entry) => entry.name)
    .sort();
}

export interface BaseVersionDiscoveryReport {
  activeBaseVersionFromXml: string | null;
  remoteAvailableBaseVersions: string[];
  localImportedBaseVersions: string[];
  missingLocally: string[];
  missingRemotely: string[];
}

export async function buildBaseVersionDiscoveryReport(
  seeds: string[] = [...KNOWN_IBUS_BASE_VERSION_SEEDS],
): Promise<BaseVersionDiscoveryReport> {
  const activeBaseVersionFromXml = await fetchActiveBaseVersionFromXml().catch(
    () => null,
  );
  const remoteAvailableBaseVersions = await discoverRemoteBaseVersions(seeds);
  const localImportedBaseVersions = await listLocalBaseVersions();
  const remoteSet = new Set(remoteAvailableBaseVersions);
  const localSet = new Set(localImportedBaseVersions);

  return {
    activeBaseVersionFromXml,
    remoteAvailableBaseVersions,
    localImportedBaseVersions,
    missingLocally: remoteAvailableBaseVersions.filter(
      (version) => !localSet.has(version),
    ),
    missingRemotely: localImportedBaseVersions.filter(
      (version) => !remoteSet.has(version),
    ),
  };
}
