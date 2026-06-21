import fs from "node:fs";
import path from "node:path";
import type { IbusMultiVersionManifest } from "@/lib/ibus/types";

const IBUS_ROOT = path.join(process.cwd(), "public", "data", "ibus");

export function readLocalIbusManifest(): IbusMultiVersionManifest {
  const manifestPath = path.join(IBUS_ROOT, "current.json");
  return JSON.parse(fs.readFileSync(manifestPath, "utf8")) as IbusMultiVersionManifest;
}

export function listLocalIbusFixtureVersions(): string[] {
  return fs
    .readdirSync(IBUS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{8}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

export function getLocalIbusFixtureVersion(): string {
  const manifest = readLocalIbusManifest();
  const localVersions = listLocalIbusFixtureVersions();
  const preferred =
    manifest.activeBaseVersionFromXml ??
    manifest.availableBaseVersions?.find((version) =>
      localVersions.includes(version),
    ) ??
    manifest.baseVersion;

  if (localVersions.includes(preferred)) {
    return preferred;
  }

  const fallback = localVersions.at(-1);
  if (!fallback) {
    throw new Error("No local iBus baseVersion folder found under public/data/ibus/");
  }

  return fallback;
}

export function localRouteSchedulePath(
  routeId: string,
  baseVersion = getLocalIbusFixtureVersion(),
): string {
  return path.join(
    IBUS_ROOT,
    baseVersion,
    "route-schedules",
    `${routeId}.json`,
  );
}

export function readLocalRouteSchedule(routeId: string, baseVersion?: string): unknown {
  return JSON.parse(
    fs.readFileSync(localRouteSchedulePath(routeId, baseVersion), "utf8"),
  );
}
