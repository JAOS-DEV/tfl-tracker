import { parseBaseVersionXml } from "@/lib/ibus/baseVersion";

export const IBUS_ROOT = "https://ibus.data.tfl.gov.uk";

export type IbusDownloadMethod = "direct-file-urls";

export interface IbusDownloadUrls {
  baseVersion: string;
  downloadMethod: IbusDownloadMethod;
  baseVersionXml: string;
  vehicleZip: string;
  garageZip: string;
  lineZip: string;
  stopPointZip: string;
  operatorScheduleZip: (operatorCode: string) => string;
  patternDataZip: (contractLineNo: string) => string;
}

const HASH_ROUTE_PATTERN = /#!Base_Version_/i;
const FOLDER_URL_PATTERN = /\/Base_Version_\d+\/?$/;

export function isInvalidIbusFolderUrl(url: string): boolean {
  if (HASH_ROUTE_PATTERN.test(url)) {
    return true;
  }

  return FOLDER_URL_PATTERN.test(url.replace(/\/+$/, ""));
}

export function isHashStyleIbusUrl(url: string): boolean {
  return HASH_ROUTE_PATTERN.test(url);
}

export function resolveIbusDownloadUrls(baseVersion: string): IbusDownloadUrls {
  const filePrefix = `${IBUS_ROOT}/Base_Version_${baseVersion}`;

  return {
    baseVersion,
    downloadMethod: "direct-file-urls",
    baseVersionXml: `${IBUS_ROOT}/Base_Version.xml`,
    vehicleZip: `${filePrefix}/Vehicle_${baseVersion}.zip`,
    garageZip: `${filePrefix}/Garage_${baseVersion}.zip`,
    lineZip: `${filePrefix}/Line_${baseVersion}.zip`,
    stopPointZip: `${filePrefix}/Stop_Point_${baseVersion}.zip`,
    operatorScheduleZip: (operatorCode: string) =>
      `${filePrefix}/${operatorCode}/schedule_${operatorCode}_${baseVersion}.zip`,
    patternDataZip: (contractLineNo: string) =>
      `${filePrefix}/Pattern_data_${contractLineNo}_${baseVersion}.zip`,
  };
}

export async function verifyUrlExists(url: string): Promise<boolean> {
  if (isInvalidIbusFolderUrl(url)) {
    return false;
  }

  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

export async function getCurrentBaseVersion(): Promise<string> {
  const xml = await fetchIbusText(
    `${IBUS_ROOT}/Base_Version.xml`,
    "Base_Version.xml",
  );
  return parseBaseVersionXml(xml);
}

export interface VerifyDownloadMethodResult {
  downloadMethod: IbusDownloadMethod;
  folderListingWorks: boolean;
  sampleFileWorks: boolean;
  warnings: string[];
}

export async function verifyDownloadMethod(
  baseVersion: string,
): Promise<VerifyDownloadMethodResult> {
  const urls = resolveIbusDownloadUrls(baseVersion);
  const folderUrl = `${IBUS_ROOT}/Base_Version_${baseVersion}/`;
  const warnings: string[] = [];

  const folderListingWorks = await verifyUrlExists(folderUrl);
  if (folderListingWorks) {
    warnings.push(
      `Unexpected: folder listing URL responded OK (${folderUrl}). Using direct file URLs anyway.`,
    );
  }

  const sampleFileWorks = await verifyUrlExists(urls.vehicleZip);
  if (!sampleFileWorks) {
    warnings.push(
      `Vehicle zip not found at expected path: ${urls.vehicleZip}. Import may fail.`,
    );
  }

  if (!folderListingWorks && sampleFileWorks) {
    warnings.push(
      `Folder listing URL returns 404 (${folderUrl}); using direct file URLs under Base_Version_${baseVersion}/ instead.`,
    );
  }

  return {
    downloadMethod: "direct-file-urls",
    folderListingWorks,
    sampleFileWorks,
    warnings,
  };
}

export async function fetchIbusText(
  url: string,
  description: string,
): Promise<string> {
  if (isInvalidIbusFolderUrl(url)) {
    throw new Error(
      `Refusing to fetch invalid iBus folder/hash URL for ${description}: ${url}`,
    );
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${description} (${url}): HTTP ${response.status}`,
    );
  }

  return response.text();
}

export async function fetchIbusBuffer(
  url: string,
  description: string,
): Promise<Buffer | null> {
  if (isInvalidIbusFolderUrl(url)) {
    throw new Error(
      `Refusing to fetch invalid iBus folder/hash URL for ${description}: ${url}`,
    );
  }

  const response = await fetch(url);
  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${description} (${url}): HTTP ${response.status}`,
    );
  }

  return Buffer.from(await response.arrayBuffer());
}
