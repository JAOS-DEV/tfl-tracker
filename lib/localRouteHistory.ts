import { STORAGE_KEYS, readJsonStorage, writeJsonStorage } from "@/lib/storage";
import type { RouteIntelligenceResult } from "@/lib/tfl/types";

export const HISTORY_RETENTION_MS = 24 * 60 * 60 * 1000;
export const MAX_SNAPSHOT_COUNT = 500;
export const MIN_SNAPSHOT_INTERVAL_MS = 25_000;
export const DUPLICATE_RECENT_WINDOW_MS = 5 * 60 * 1000;

export const ROUTE_HISTORY_EVENT = "tfl-tracker:route-history";

export interface RouteHistoryDirectionSummary {
  liveVehicleCount: number;
  largestGapMinutes: number | null;
  bunchingClusterCount: number;
  largeGapCount: number;
}

export interface RouteHistorySnapshot {
  id: string;
  timestamp: number;
  routeId: string;
  routeName: string;
  liveVehicleCount: number;
  healthScore: number;
  healthLabel: string;
  averageGapMinutes: number | null;
  largestGapMinutes: number | null;
  smallestGapMinutes: number | null;
  bunchingClusterCount: number;
  largeGapCount: number;
  missingFromRefreshCount: number;
  disappearedPredictionCount: number;
  isDataStale: boolean;
  outbound: RouteHistoryDirectionSummary;
  inbound: RouteHistoryDirectionSummary;
}

export interface RouteHistoryDailyStats {
  snapshotCount: number;
  bestHealthScore: number | null;
  worstHealthScore: number | null;
  averageHealthScore: number | null;
  worstLargestGapMinutes: number | null;
  totalBunchingEvents: number;
  totalLargeGapEvents: number;
}

export interface RouteHistoryComparisonRow {
  routeId: string;
  routeName: string;
  snapshotCount: number;
  averageHealthScore: number | null;
  worstHealthScore: number | null;
  worstLargestGapMinutes: number | null;
  totalBunchingEvents: number;
  totalLargeGapEvents: number;
  lastSnapshotAt: number | null;
}

export function createSnapshotFromIntelligence(
  routeId: string,
  routeName: string,
  intelligence: RouteIntelligenceResult,
  timestamp: number,
): RouteHistorySnapshot {
  const { metrics } = intelligence;

  return {
    id: `${routeId}-${timestamp}`,
    timestamp,
    routeId,
    routeName,
    liveVehicleCount: metrics.liveVehicleCount,
    healthScore: metrics.healthScore,
    healthLabel: metrics.healthLabel,
    averageGapMinutes: metrics.averageGapMinutes,
    largestGapMinutes: metrics.largestGapMinutes,
    smallestGapMinutes: metrics.smallestGapMinutes,
    bunchingClusterCount: metrics.bunchingClusterCount,
    largeGapCount: metrics.largeGapCount,
    missingFromRefreshCount: metrics.missingFromRefreshCount,
    disappearedPredictionCount: metrics.disappearedPredictionCount,
    isDataStale: metrics.isDataStale,
    outbound: {
      liveVehicleCount: metrics.outbound.liveVehicleCount,
      largestGapMinutes: metrics.outbound.largestGapMinutes,
      bunchingClusterCount: metrics.outbound.bunchingClusterCount,
      largeGapCount: metrics.outbound.largeGapCount,
    },
    inbound: {
      liveVehicleCount: metrics.inbound.liveVehicleCount,
      largestGapMinutes: metrics.inbound.largestGapMinutes,
      bunchingClusterCount: metrics.inbound.bunchingClusterCount,
      largeGapCount: metrics.inbound.largeGapCount,
    },
  };
}

export function snapshotsHaveIdenticalMetrics(
  left: RouteHistorySnapshot,
  right: RouteHistorySnapshot,
): boolean {
  return (
    left.healthScore === right.healthScore &&
    left.liveVehicleCount === right.liveVehicleCount &&
    left.averageGapMinutes === right.averageGapMinutes &&
    left.largestGapMinutes === right.largestGapMinutes &&
    left.smallestGapMinutes === right.smallestGapMinutes &&
    left.bunchingClusterCount === right.bunchingClusterCount &&
    left.largeGapCount === right.largeGapCount &&
    left.missingFromRefreshCount === right.missingFromRefreshCount &&
    left.disappearedPredictionCount === right.disappearedPredictionCount &&
    left.isDataStale === right.isDataStale
  );
}

export function shouldSaveSnapshot(
  candidate: RouteHistorySnapshot,
  previous: RouteHistorySnapshot | null,
  now: number,
): boolean {
  if (!previous) {
    return true;
  }

  if (candidate.timestamp - previous.timestamp < MIN_SNAPSHOT_INTERVAL_MS) {
    return false;
  }

  const isRecent =
    now - previous.timestamp <= DUPLICATE_RECENT_WINDOW_MS;

  if (isRecent && snapshotsHaveIdenticalMetrics(candidate, previous)) {
    return false;
  }

  return true;
}

export function pruneSnapshots(
  snapshots: RouteHistorySnapshot[],
  now: number,
): RouteHistorySnapshot[] {
  const cutoff = now - HISTORY_RETENTION_MS;
  const withinRetention = snapshots.filter(
    (snapshot) => snapshot.timestamp >= cutoff,
  );
  const sorted = [...withinRetention].sort(
    (left, right) => left.timestamp - right.timestamp,
  );

  if (sorted.length <= MAX_SNAPSHOT_COUNT) {
    return sorted;
  }

  return sorted.slice(sorted.length - MAX_SNAPSHOT_COUNT);
}

export function getLatestSnapshotForRoute(
  snapshots: RouteHistorySnapshot[],
  routeId: string,
): RouteHistorySnapshot | null {
  const routeSnapshots = snapshots
    .filter((snapshot) => snapshot.routeId === routeId)
    .sort((left, right) => right.timestamp - left.timestamp);

  return routeSnapshots[0] ?? null;
}

export function startOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function endOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

export function filterSnapshotsForDay(
  snapshots: RouteHistorySnapshot[],
  referenceTimestamp: number,
): RouteHistorySnapshot[] {
  const dayStart = startOfLocalDay(referenceTimestamp);
  const dayEnd = endOfLocalDay(referenceTimestamp);
  return snapshots.filter(
    (snapshot) =>
      snapshot.timestamp >= dayStart && snapshot.timestamp <= dayEnd,
  );
}

export function calculateDailyStats(
  snapshots: RouteHistorySnapshot[],
  referenceTimestamp = Date.now(),
): RouteHistoryDailyStats {
  const todaySnapshots = filterSnapshotsForDay(snapshots, referenceTimestamp);

  if (todaySnapshots.length === 0) {
    return {
      snapshotCount: 0,
      bestHealthScore: null,
      worstHealthScore: null,
      averageHealthScore: null,
      worstLargestGapMinutes: null,
      totalBunchingEvents: 0,
      totalLargeGapEvents: 0,
    };
  }

  const healthScores = todaySnapshots.map((snapshot) => snapshot.healthScore);
  const largestGaps = todaySnapshots
    .map((snapshot) => snapshot.largestGapMinutes)
    .filter((gap): gap is number => gap !== null);

  return {
    snapshotCount: todaySnapshots.length,
    bestHealthScore: Math.max(...healthScores),
    worstHealthScore: Math.min(...healthScores),
    averageHealthScore: Math.round(
      healthScores.reduce((sum, score) => sum + score, 0) /
        healthScores.length,
    ),
    worstLargestGapMinutes:
      largestGaps.length > 0 ? Math.max(...largestGaps) : null,
    totalBunchingEvents: todaySnapshots.reduce(
      (sum, snapshot) => sum + snapshot.bunchingClusterCount,
      0,
    ),
    totalLargeGapEvents: todaySnapshots.reduce(
      (sum, snapshot) => sum + snapshot.largeGapCount,
      0,
    ),
  };
}

export function buildComparisonRows(
  snapshots: RouteHistorySnapshot[],
  routeIds: string[],
  referenceTimestamp = Date.now(),
): RouteHistoryComparisonRow[] {
  const todaySnapshots = filterSnapshotsForDay(snapshots, referenceTimestamp);

  return routeIds.map((routeId) => {
    const routeSnapshots = todaySnapshots.filter(
      (snapshot) => snapshot.routeId === routeId,
    );
    const stats = calculateDailyStats(routeSnapshots, referenceTimestamp);
    const lastSnapshot = getLatestSnapshotForRoute(snapshots, routeId);

    return {
      routeId,
      routeName: lastSnapshot?.routeName ?? routeId,
      snapshotCount: stats.snapshotCount,
      averageHealthScore: stats.averageHealthScore,
      worstHealthScore: stats.worstHealthScore,
      worstLargestGapMinutes: stats.worstLargestGapMinutes,
      totalBunchingEvents: stats.totalBunchingEvents,
      totalLargeGapEvents: stats.totalLargeGapEvents,
      lastSnapshotAt: lastSnapshot?.timestamp ?? null,
    };
  });
}

export function exportSnapshotsAsJson(
  snapshots: RouteHistorySnapshot[],
): string {
  return JSON.stringify(snapshots, null, 2);
}

function escapeCsvValue(value: string | number | boolean | null): string {
  if (value === null) {
    return "";
  }

  const text = String(value);
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

export function exportSnapshotsAsCsv(
  snapshots: RouteHistorySnapshot[],
): string {
  const headers = [
    "id",
    "timestamp",
    "routeId",
    "routeName",
    "liveVehicleCount",
    "healthScore",
    "healthLabel",
    "averageGapMinutes",
    "largestGapMinutes",
    "smallestGapMinutes",
    "bunchingClusterCount",
    "largeGapCount",
    "missingFromRefreshCount",
    "disappearedPredictionCount",
    "isDataStale",
  ];

  const rows = snapshots.map((snapshot) =>
    [
      snapshot.id,
      snapshot.timestamp,
      snapshot.routeId,
      snapshot.routeName,
      snapshot.liveVehicleCount,
      snapshot.healthScore,
      snapshot.healthLabel,
      snapshot.averageGapMinutes,
      snapshot.largestGapMinutes,
      snapshot.smallestGapMinutes,
      snapshot.bunchingClusterCount,
      snapshot.largeGapCount,
      snapshot.missingFromRefreshCount,
      snapshot.disappearedPredictionCount,
      snapshot.isDataStale,
    ]
      .map(escapeCsvValue)
      .join(","),
  );

  return [headers.join(","), ...rows].join("\n");
}

const EMPTY_SNAPSHOTS: RouteHistorySnapshot[] = [];

interface RouteHistoryCache {
  raw: string | null;
  allSnapshots: RouteHistorySnapshot[];
  snapshotsByRoute: Map<string, RouteHistorySnapshot[]>;
}

let routeHistoryCache: RouteHistoryCache | null = null;

function readHistoryRaw(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(STORAGE_KEYS.routeHistory);
}

function buildRouteHistoryCache(
  raw: string | null,
  allSnapshots: RouteHistorySnapshot[],
): RouteHistoryCache {
  const snapshotsByRoute = new Map<string, RouteHistorySnapshot[]>();

  for (const snapshot of allSnapshots) {
    const existing = snapshotsByRoute.get(snapshot.routeId) ?? [];
    existing.push(snapshot);
    snapshotsByRoute.set(snapshot.routeId, existing);
  }

  for (const [routeId, routeSnapshots] of snapshotsByRoute.entries()) {
    snapshotsByRoute.set(
      routeId,
      [...routeSnapshots].sort((left, right) => left.timestamp - right.timestamp),
    );
  }

  return {
    raw,
    allSnapshots,
    snapshotsByRoute,
  };
}

function getRouteHistoryCache(): RouteHistoryCache {
  const raw = readHistoryRaw();

  if (routeHistoryCache && routeHistoryCache.raw === raw) {
    return routeHistoryCache;
  }

  const allSnapshots =
    raw === null
      ? EMPTY_SNAPSHOTS
      : readJsonStorage<RouteHistorySnapshot[]>(
          STORAGE_KEYS.routeHistory,
          EMPTY_SNAPSHOTS,
        );

  routeHistoryCache = buildRouteHistoryCache(raw, allSnapshots);
  return routeHistoryCache;
}

export function invalidateRouteHistoryCache(): void {
  routeHistoryCache = null;
}

export function loadAllSnapshots(): RouteHistorySnapshot[] {
  if (typeof window === "undefined") {
    return EMPTY_SNAPSHOTS;
  }

  return getRouteHistoryCache().allSnapshots;
}

export function saveAllSnapshots(snapshots: RouteHistorySnapshot[]): void {
  if (typeof window === "undefined") {
    return;
  }

  writeJsonStorage(STORAGE_KEYS.routeHistory, snapshots);
  const raw = readHistoryRaw();
  routeHistoryCache = buildRouteHistoryCache(raw, snapshots);
  window.dispatchEvent(new Event(ROUTE_HISTORY_EVENT));
}

export function appendRouteSnapshot(
  routeId: string,
  routeName: string,
  intelligence: RouteIntelligenceResult,
  timestamp: number,
  now = Date.now(),
): RouteHistorySnapshot | null {
  const candidate = createSnapshotFromIntelligence(
    routeId,
    routeName,
    intelligence,
    timestamp,
  );
  const existing = loadAllSnapshots();
  const previous = getLatestSnapshotForRoute(existing, routeId);

  if (!shouldSaveSnapshot(candidate, previous, now)) {
    return null;
  }

  const next = pruneSnapshots([...existing, candidate], now);
  saveAllSnapshots(next);
  return candidate;
}

export function clearRouteHistory(routeId: string): void {
  const remaining = loadAllSnapshots().filter(
    (snapshot) => snapshot.routeId !== routeId,
  );
  saveAllSnapshots(remaining);
}

export function clearAllRouteHistory(): void {
  saveAllSnapshots([]);
}

export function getSnapshotsForRoute(routeId: string): RouteHistorySnapshot[] {
  if (typeof window === "undefined") {
    return EMPTY_SNAPSHOTS;
  }

  return getRouteHistoryCache().snapshotsByRoute.get(routeId) ?? EMPTY_SNAPSHOTS;
}
