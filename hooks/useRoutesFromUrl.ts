"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ActiveRoute, LineSearchResult } from "@/lib/tfl/types";
import {
  getMissingRouteIds,
  orderRoutesByUrl,
} from "@/lib/sharedRouteRestore";
import { parseRoutesParam, serializeRoutesParam } from "@/lib/routeUrl";
import {
  MAX_ACTIVE_ROUTES,
  addActiveRoute,
  addRecentRoute,
} from "@/lib/storage";

export async function resolveRoute(
  routeId: string,
): Promise<ActiveRoute | null> {
  const response = await fetch(
    `/api/tfl/line-search?query=${encodeURIComponent(routeId)}`,
  );

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as { results: LineSearchResult[] };
  const match =
    data.results.find(
      (result) => result.id.toLowerCase() === routeId.toLowerCase(),
    ) ?? data.results[0];

  if (!match) {
    return null;
  }

  return {
    routeId: match.id,
    routeName: match.name,
    addedAt: Date.now(),
  };
}

export async function resolveRoutesFromIds(
  routeIds: string[],
  existingActive: ActiveRoute[],
): Promise<{
  activeRoutes: ActiveRoute[];
  recentAdditions: ActiveRoute[];
  invalidRouteIds: string[];
}> {
  let nextActive = [...existingActive];
  const recentAdditions: ActiveRoute[] = [];
  const invalidRouteIds: string[] = [];

  for (const routeId of routeIds) {
    if (
      nextActive.some(
        (route) => route.routeId.toLowerCase() === routeId.toLowerCase(),
      )
    ) {
      continue;
    }

    if (nextActive.length >= MAX_ACTIVE_ROUTES) {
      break;
    }

    const resolved = await resolveRoute(routeId);
    if (!resolved) {
      invalidRouteIds.push(routeId);
      continue;
    }

    nextActive = addActiveRoute(nextActive, resolved);
    recentAdditions.push(resolved);
  }

  return { activeRoutes: nextActive, recentAdditions, invalidRouteIds };
}

type RoutesUpdater = ActiveRoute[] | ((current: ActiveRoute[]) => ActiveRoute[]);

interface UseRoutesFromUrlOptions {
  isHydrated: boolean;
  activeRoutes: ActiveRoute[];
  onActiveRoutesChange: (routes: RoutesUpdater) => void;
  onRecentRoutesChange: (routes: RoutesUpdater) => void;
  onUrlLoadError?: (invalidRouteIds: string[]) => void;
}

interface RouteHistoryState {
  activeRoutes?: ActiveRoute[];
}

function readRoutesFromLocation(): string[] {
  return parseRoutesParam(
    new URLSearchParams(window.location.search).get("routes"),
  );
}

export function pushRoutesToUrl(activeRoutes: ActiveRoute[]): void {
  const url = new URL(window.location.href);
  const serialized = serializeRoutesParam(
    activeRoutes.map((route) => route.routeId),
  );

  if (serialized) {
    url.searchParams.set("routes", serialized);
  } else {
    url.searchParams.delete("routes");
  }

  const state: RouteHistoryState = { activeRoutes };
  window.history.pushState(state, "", url.toString());
}

export function replaceRoutesInUrl(activeRoutes: ActiveRoute[]): void {
  const url = new URL(window.location.href);
  const serialized = serializeRoutesParam(
    activeRoutes.map((route) => route.routeId),
  );

  if (serialized) {
    url.searchParams.set("routes", serialized);
  } else {
    url.searchParams.delete("routes");
  }

  const state: RouteHistoryState = { activeRoutes };
  window.history.replaceState(state, "", url.toString());
}

export function useRoutesFromUrl({
  isHydrated,
  activeRoutes,
  onActiveRoutesChange,
  onRecentRoutesChange,
  onUrlLoadError,
}: UseRoutesFromUrlOptions): void {
  const hasLoadedFromUrl = useRef(false);
  const skipNextUrlSync = useRef(false);
  const isInitialUrlSync = useRef(true);

  const applyRoutesFromHistory = useCallback(
    async (routeIds: string[], historyRoutes?: ActiveRoute[]) => {
      skipNextUrlSync.current = true;

      if (routeIds.length === 0) {
        onActiveRoutesChange([]);
        return;
      }

      const baseRoutes = historyRoutes ?? [];
      const missingRouteIds = getMissingRouteIds(routeIds, baseRoutes);

      if (missingRouteIds.length === 0 && baseRoutes.length > 0) {
        onActiveRoutesChange(orderRoutesByUrl(routeIds, baseRoutes));
        return;
      }

      const { activeRoutes: resolved, recentAdditions, invalidRouteIds } =
        await resolveRoutesFromIds(
          missingRouteIds.length > 0 ? missingRouteIds : routeIds,
          baseRoutes,
        );

      if (recentAdditions.length > 0) {
        onRecentRoutesChange((recent) => {
          let next = recent;
          for (const route of recentAdditions) {
            next = addRecentRoute(next, route);
          }
          return next;
        });
      }

      onActiveRoutesChange(orderRoutesByUrl(routeIds, resolved));

      if (invalidRouteIds.length > 0) {
        onUrlLoadError?.(invalidRouteIds);
      }
    },
    [onActiveRoutesChange, onRecentRoutesChange, onUrlLoadError],
  );

  useEffect(() => {
    if (!isHydrated || hasLoadedFromUrl.current) {
      return;
    }

    const routeIds = readRoutesFromLocation();
    if (routeIds.length === 0) {
      hasLoadedFromUrl.current = true;
      return;
    }

    hasLoadedFromUrl.current = true;

    void (async () => {
      const { activeRoutes: resolved, recentAdditions, invalidRouteIds } =
        await resolveRoutesFromIds(routeIds, activeRoutes);

      if (recentAdditions.length > 0) {
        onRecentRoutesChange((recent) => {
          let next = recent;
          for (const route of recentAdditions) {
            next = addRecentRoute(next, route);
          }
          return next;
        });
      }

      if (
        resolved.length !== activeRoutes.length ||
        resolved.some(
          (route, index) => route.routeId !== activeRoutes[index]?.routeId,
        )
      ) {
        skipNextUrlSync.current = true;
        onActiveRoutesChange(resolved);
      }

      replaceRoutesInUrl(resolved.length > 0 ? resolved : activeRoutes);

      if (invalidRouteIds.length > 0) {
        onUrlLoadError?.(invalidRouteIds);
      }
    })();
  }, [
    isHydrated,
    activeRoutes,
    onActiveRoutesChange,
    onRecentRoutesChange,
    onUrlLoadError,
  ]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (skipNextUrlSync.current) {
      skipNextUrlSync.current = false;
      return;
    }

    if (isInitialUrlSync.current) {
      isInitialUrlSync.current = false;
      replaceRoutesInUrl(activeRoutes);
      return;
    }

    pushRoutesToUrl(activeRoutes);
  }, [activeRoutes, isHydrated]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const handlePopState = (event: PopStateEvent) => {
      const historyState = event.state as RouteHistoryState | null;
      const routeIds = readRoutesFromLocation();
      void applyRoutesFromHistory(routeIds, historyState?.activeRoutes);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isHydrated, applyRoutesFromHistory]);
}
