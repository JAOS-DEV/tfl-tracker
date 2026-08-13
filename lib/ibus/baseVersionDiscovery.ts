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
  /** Primary version the app points at via public/data/ibus/current.json */
  appCurrentBaseVersion: string | null;
  remoteAvailableBaseVersions: string[];
  localImportedBaseVersions: string[];
  missingLocally: string[];
  missingRemotely: string[];
}

export async function readAppCurrentBaseVersion(
  ibusRoot = getIbusDataRoot(),
): Promise<string | null> {
  try {
    const raw = await fs.readFile(path.join(ibusRoot, "current.json"), "utf8");
    const manifest = JSON.parse(raw) as { baseVersion?: unknown };
    return typeof manifest.baseVersion === "string" &&
      isValidBaseVersionId(manifest.baseVersion)
      ? manifest.baseVersion
      : null;
  } catch {
    return null;
  }
}

export type BaseVersionSyncStatus =
  | "up-to-date"
  | "update-needed"
  | "unknown";

export function resolveBaseVersionSyncStatus(
  activeBaseVersionFromXml: string | null,
  appCurrentBaseVersion: string | null,
  localImportedBaseVersions: string[] = [],
): BaseVersionSyncStatus {
  if (!activeBaseVersionFromXml) {
    return "unknown";
  }

  if (appCurrentBaseVersion === activeBaseVersionFromXml) {
    return "up-to-date";
  }

  if (localImportedBaseVersions.includes(activeBaseVersionFromXml)) {
    // Folder exists but current.json still points elsewhere
    return "update-needed";
  }

  if (appCurrentBaseVersion && appCurrentBaseVersion !== activeBaseVersionFromXml) {
    return "update-needed";
  }

  return "update-needed";
}

export function formatBaseVersionStatusLines(report: {
  activeBaseVersionFromXml: string | null;
  appCurrentBaseVersion: string | null;
  localImportedBaseVersions: string[];
}): string[] {
  const active = report.activeBaseVersionFromXml ?? "unknown";
  const current = report.appCurrentBaseVersion ?? "none (no current.json)";
  const status = resolveBaseVersionSyncStatus(
    report.activeBaseVersionFromXml,
    report.appCurrentBaseVersion,
    report.localImportedBaseVersions,
  );

  const statusLabel =
    status === "up-to-date"
      ? "UP TO DATE — app is using the TfL active version"
      : status === "update-needed"
        ? "UPDATE NEEDED — run: npm run check:ibus"
        : "UNKNOWN — could not read TfL active version";

  return [
    `TfL active version (live predictions use this): ${active}`,
    `App current version (what this project uses):   ${current}`,
    `Status: ${statusLabel}`,
  ];
}

export async function buildBaseVersionDiscoveryReport(
  seeds: string[] = [...KNOWN_IBUS_BASE_VERSION_SEEDS],
): Promise<BaseVersionDiscoveryReport> {
  const activeBaseVersionFromXml = await fetchActiveBaseVersionFromXml().catch(
    () => null,
  );
  const appCurrentBaseVersion = await readAppCurrentBaseVersion();
  const remoteAvailableBaseVersions = await discoverRemoteBaseVersions(seeds);
  const localImportedBaseVersions = await listLocalBaseVersions();
  const remoteSet = new Set(remoteAvailableBaseVersions);
  const localSet = new Set(localImportedBaseVersions);

  return {
    activeBaseVersionFromXml,
    appCurrentBaseVersion,
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
