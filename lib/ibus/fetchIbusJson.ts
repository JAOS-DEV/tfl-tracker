import {
  buildIbusDataUrl,
  isIbusManifestRelativePath,
} from "@/lib/ibus/dataUrl";

export type IbusFetchTrackKind =
  | "manifest"
  | "routeSchedule"
  | "runningShard"
  | "vehicleLookup"
  | "garageLookup";

export interface IbusFetchDiagnostics {
  manifestLoadedFrom?: string;
  routeScheduleLoadedFrom?: string;
  runningShardLoadedFrom?: string;
}

const lastLoadedFrom: Partial<Record<IbusFetchTrackKind, string>> = {};

export function clearIbusFetchDiagnostics(): void {
  for (const key of Object.keys(lastLoadedFrom) as IbusFetchTrackKind[]) {
    delete lastLoadedFrom[key];
  }
}

export function getIbusFetchDiagnostics(): IbusFetchDiagnostics {
  return {
    manifestLoadedFrom: lastLoadedFrom.manifest,
    routeScheduleLoadedFrom: lastLoadedFrom.routeSchedule,
    runningShardLoadedFrom: lastLoadedFrom.runningShard,
  };
}

export async function fetchIbusJson<T>(
  relativePath: string,
  options?: { trackAs?: IbusFetchTrackKind },
): Promise<{ data: T | null; loadedFrom: string }> {
  const loadedFrom = buildIbusDataUrl(relativePath);

  if (options?.trackAs) {
    lastLoadedFrom[options.trackAs] = loadedFrom;
  }

  try {
    const response = await fetch(loadedFrom, {
      cache: isIbusManifestRelativePath(relativePath) ? "default" : "force-cache",
    });
    if (!response.ok) {
      if (response.status === 404 && process.env.NODE_ENV === "development") {
        console.debug(`iBus static JSON not found (expected): ${loadedFrom}`);
      }
      return { data: null, loadedFrom };
    }

    return { data: (await response.json()) as T, loadedFrom };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.debug("iBus static JSON fetch failed:", loadedFrom, error);
    }
    return { data: null, loadedFrom };
  }
}
