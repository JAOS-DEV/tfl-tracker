export const COMPACT_ROUTE_SCHEDULE_SCHEMA_VERSION = 2 as const;

export interface CompactStopRecord {
  /** Stop name */
  n?: string;
  /** Stop code (timing point / NaPTAN fallback) */
  c?: string;
}

export interface CompactJourneyRecord {
  /** tripId */
  t: string;
  /** runningNo */
  r?: string;
  /** blockNo */
  b?: string;
  /** garageNo */
  g?: string;
  /** operatorCode */
  o?: string;
  /** direction */
  d: string;
  /** patternId */
  p: string;
  /** start seconds from local midnight */
  s: number;
  /** end seconds from local midnight */
  e: number;
  /** service day bitmask (Sun=1, Mon=2, ... Sat=64); omitted = all days */
  y?: number;
  /** stop time offsets from journey start, aligned to pattern stop order */
  w: number[];
}

export interface CompactRouteScheduleV2 {
  schemaVersion: typeof COMPACT_ROUTE_SCHEDULE_SCHEMA_VERSION;
  baseVersion: string;
  routeId: string;
  generatedAt: string;
  /** stopId -> compact stop details */
  stops: Record<string, CompactStopRecord>;
  /** patternId -> ordered stop ids */
  patterns: Record<string, string[]>;
  /** patternId -> direction */
  dirs?: Record<string, string>;
  journeys: CompactJourneyRecord[];
}

export function isCompactRouteScheduleV2(
  value: unknown,
): value is CompactRouteScheduleV2 {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as CompactRouteScheduleV2).schemaVersion ===
      COMPACT_ROUTE_SCHEDULE_SCHEMA_VERSION
  );
}

/** Sun=1, Mon=2, Tue=4, Wed=8, Thu=16, Fri=32, Sat=64 */
export function serviceDaysToBitmask(serviceDays: number[]): number | undefined {
  if (serviceDays.length === 0) {
    return undefined;
  }

  let mask = 0;
  for (const day of serviceDays) {
    if (day >= 0 && day <= 6) {
      mask |= 1 << day;
    }
  }

  return mask || undefined;
}

export function bitmaskToServiceDays(bitmask?: number): number[] {
  if (bitmask === undefined || bitmask === 0) {
    return [];
  }

  const days: number[] = [];
  for (let day = 0; day <= 6; day += 1) {
    if (bitmask & (1 << day)) {
      days.push(day);
    }
  }

  return days;
}
