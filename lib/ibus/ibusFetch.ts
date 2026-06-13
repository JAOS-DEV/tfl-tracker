import {
  cacheRelativePathForUrl,
  readCachedBuffer,
  readCachedText,
  writeCachedBuffer,
  writeCachedText,
} from "@/lib/ibus/cache";
import {
  fetchIbusBuffer,
  fetchIbusText,
  getCurrentBaseVersion,
  resolveIbusDownloadUrls,
  verifyDownloadMethod,
} from "@/lib/ibus/download";

export interface IbusFetchStats {
  cacheHits: number;
  cacheMisses: number;
  downloads: number;
}

export interface IbusFetchContext {
  baseVersion: string;
  stats: IbusFetchStats;
  warnings: string[];
}

export function createIbusFetchContext(baseVersion: string): IbusFetchContext {
  return {
    baseVersion,
    stats: { cacheHits: 0, cacheMisses: 0, downloads: 0 },
    warnings: [],
  };
}

export async function prepareIbusImport(): Promise<{
  baseVersion: string;
  urls: ReturnType<typeof resolveIbusDownloadUrls>;
  context: IbusFetchContext;
  downloadVerification: Awaited<ReturnType<typeof verifyDownloadMethod>>;
}> {
  const baseVersion = await getCurrentBaseVersion();
  const urls = resolveIbusDownloadUrls(baseVersion);
  const context = createIbusFetchContext(baseVersion);
  const downloadVerification = await verifyDownloadMethod(baseVersion);
  context.warnings.push(...downloadVerification.warnings);

  const cachedBaseVersion = await readCachedText(baseVersion, "Base_Version.xml");
  if (!cachedBaseVersion) {
    const xml = await fetchIbusText(urls.baseVersionXml, "Base_Version.xml");
    await writeCachedText(baseVersion, "Base_Version.xml", xml);
  } else {
    context.stats.cacheHits += 1;
  }

  return { baseVersion, urls, context, downloadVerification };
}

export async function fetchIbusZipCached(
  context: IbusFetchContext,
  url: string,
  description: string,
): Promise<Buffer | null> {
  const relativePath = cacheRelativePathForUrl(context.baseVersion, url);
  const cached = await readCachedBuffer(context.baseVersion, relativePath);
  if (cached) {
    context.stats.cacheHits += 1;
    return cached;
  }

  context.stats.cacheMisses += 1;
  const buffer = await fetchIbusBuffer(url, description);
  if (buffer) {
    context.stats.downloads += 1;
    await writeCachedBuffer(context.baseVersion, relativePath, buffer);
  }

  return buffer;
}

export { getCurrentBaseVersion, resolveIbusDownloadUrls, verifyDownloadMethod };
