import fs from "node:fs/promises";
import path from "node:path";

export const IBUS_CACHE_ROOT = ".ibus-cache";

export function isForceDownload(): boolean {
  return process.env.IBUS_FORCE_DOWNLOAD === "1";
}

export function isCleanOldVersions(): boolean {
  return process.env.IBUS_CLEAN_OLD === "1";
}

export function getIbusCachePath(
  baseVersion: string,
  relativePath: string,
): string {
  return path.join(IBUS_CACHE_ROOT, baseVersion, relativePath);
}

export async function readCachedBuffer(
  baseVersion: string,
  relativePath: string,
): Promise<Buffer | null> {
  if (isForceDownload()) {
    return null;
  }

  const cachePath = getIbusCachePath(baseVersion, relativePath);
  try {
    return await fs.readFile(cachePath);
  } catch {
    return null;
  }
}

export async function readCachedText(
  baseVersion: string,
  relativePath: string,
): Promise<string | null> {
  const buffer = await readCachedBuffer(baseVersion, relativePath);
  return buffer ? buffer.toString("utf8") : null;
}

export async function writeCachedBuffer(
  baseVersion: string,
  relativePath: string,
  data: Buffer,
): Promise<void> {
  const cachePath = getIbusCachePath(baseVersion, relativePath);
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  await fs.writeFile(cachePath, data);
}

export async function writeCachedText(
  baseVersion: string,
  relativePath: string,
  text: string,
): Promise<void> {
  await writeCachedBuffer(baseVersion, relativePath, Buffer.from(text, "utf8"));
}

export function cacheRelativePathForUrl(
  baseVersion: string,
  url: string,
): string {
  const marker = `/Base_Version_${baseVersion}/`;
  const index = url.indexOf(marker);
  if (index >= 0) {
    return url.slice(index + marker.length);
  }

  if (url.endsWith("/Base_Version.xml")) {
    return "Base_Version.xml";
  }

  return path.basename(url);
}
