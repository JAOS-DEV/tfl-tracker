"use client";

import { useEffect, useRef } from "react";
import type { ActiveRoute, LineSearchResult } from "@/lib/tfl/types";
import {
  MAX_ACTIVE_ROUTES,
  addActiveRoute,
  addRecentRoute,
} from "@/lib/storage";

async function resolveRoute(routeId: string): Promise<ActiveRoute | null> {
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

type RoutesUpdater = ActiveRoute[] | ((current: ActiveRoute[]) => ActiveRoute[]);

interface UseRoutesFromUrlOptions {
  isHydrated: boolean;
  activeRoutes: ActiveRoute[];
  onActiveRoutesChange: (routes: RoutesUpdater) => void;
  onRecentRoutesChange: (routes: RoutesUpdater) => void;
}

export function useRoutesFromUrl({
  isHydrated,
  activeRoutes,
  onActiveRoutesChange,
  onRecentRoutesChange,
}: UseRoutesFromUrlOptions): void {
  const hasLoadedFromUrl = useRef(false);

  useEffect(() => {
    if (!isHydrated || hasLoadedFromUrl.current) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const routesParam = params.get("routes");

    if (!routesParam) {
      return;
    }

    hasLoadedFromUrl.current = true;

    const routeIds = routesParam
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, MAX_ACTIVE_ROUTES);

    if (routeIds.length === 0) {
      return;
    }

    void (async () => {
      let nextActive = [...activeRoutes];

      for (const routeId of routeIds) {
        if (nextActive.some((route) => route.routeId === routeId)) {
          continue;
        }
        if (nextActive.length >= MAX_ACTIVE_ROUTES) {
          break;
        }

        const resolved = await resolveRoute(routeId);
        if (!resolved) {
          continue;
        }

        nextActive = addActiveRoute(nextActive, resolved);
        onRecentRoutesChange((recent) => addRecentRoute(recent, resolved));
      }

      if (nextActive.length !== activeRoutes.length) {
        onActiveRoutesChange(nextActive);
      }
    })();
  }, [
    isHydrated,
    activeRoutes,
    onActiveRoutesChange,
    onRecentRoutesChange,
  ]);
}

export function syncRoutesToUrl(activeRoutes: ActiveRoute[]): void {
  const url = new URL(window.location.href);
  const routeIds = activeRoutes.map((route) => route.routeId).join(",");

  if (routeIds) {
    url.searchParams.set("routes", routeIds);
  } else {
    url.searchParams.delete("routes");
  }

  window.history.replaceState({}, "", url.toString());
}
