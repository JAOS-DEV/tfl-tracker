"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  EMPTY_ROUTE_HISTORY_SNAPSHOTS,
  ROUTE_HISTORY_EVENT,
  calculateDailyStats,
  clearAllRouteHistory,
  clearRouteHistory,
  exportSnapshotsAsCsv,
  exportSnapshotsAsJson,
  getSnapshotsForRoute,
  loadAllSnapshots,
} from "@/lib/localRouteHistory";
import type {
  RouteHistoryDailyStats,
  RouteHistorySnapshot,
} from "@/lib/localRouteHistory";

function subscribeToRouteHistory(callback: () => void): () => void {
  window.addEventListener(ROUTE_HISTORY_EVENT, callback);
  return () => window.removeEventListener(ROUTE_HISTORY_EVENT, callback);
}

interface UseRouteHistoryResult {
  snapshots: RouteHistorySnapshot[];
  dailyStats: RouteHistoryDailyStats;
  hydrated: boolean;
  refresh: () => void;
  clearRoute: () => void;
  exportJson: () => string;
  exportCsv: () => string;
}

export function useRouteHistory(
  routeId: string,
  enabled = true,
): UseRouteHistoryResult {
  const getSnapshotForRoute = useCallback(
    () => (enabled ? getSnapshotsForRoute(routeId) : EMPTY_ROUTE_HISTORY_SNAPSHOTS),
    [enabled, routeId],
  );

  const snapshots = useSyncExternalStore(
    subscribeToRouteHistory,
    getSnapshotForRoute,
    () => EMPTY_ROUTE_HISTORY_SNAPSHOTS,
  );

  const dailyStats = useMemo(
    () => calculateDailyStats(snapshots),
    [snapshots],
  );

  const refresh = useCallback(() => {
    window.dispatchEvent(new Event(ROUTE_HISTORY_EVENT));
  }, []);

  const clearRoute = useCallback(() => {
    clearRouteHistory(routeId);
  }, [routeId]);

  const exportJson = useCallback(() => {
    return exportSnapshotsAsJson(snapshots);
  }, [snapshots]);

  const exportCsv = useCallback(() => {
    return exportSnapshotsAsCsv(snapshots);
  }, [snapshots]);

  return {
    snapshots,
    dailyStats,
    hydrated: enabled,
    refresh,
    clearRoute,
    exportJson,
    exportCsv,
  };
}

interface UseAllRouteHistoryResult {
  snapshots: RouteHistorySnapshot[];
  hydrated: boolean;
  refresh: () => void;
  clearAll: () => void;
}

export function useAllRouteHistory(): UseAllRouteHistoryResult {
  const getAllSnapshots = useCallback(() => loadAllSnapshots(), []);

  const snapshots = useSyncExternalStore(
    subscribeToRouteHistory,
    getAllSnapshots,
    () => EMPTY_ROUTE_HISTORY_SNAPSHOTS,
  );

  const refresh = useCallback(() => {
    window.dispatchEvent(new Event(ROUTE_HISTORY_EVENT));
  }, []);

  const clearAll = useCallback(() => {
    clearAllRouteHistory();
  }, []);

  return {
    snapshots,
    hydrated: true,
    refresh,
    clearAll,
  };
}
