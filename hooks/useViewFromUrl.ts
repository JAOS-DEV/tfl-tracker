"use client";

import { useMemo } from "react";
import { parseViewParam } from "@/lib/routeUrl";
import type { RouteVisualMode } from "@/lib/tfl/types";

export function useViewFromUrl(isHydrated: boolean): RouteVisualMode | undefined {
  return useMemo(() => {
    if (!isHydrated || typeof window === "undefined") {
      return undefined;
    }

    return parseViewParam(new URLSearchParams(window.location.search).get("view"));
  }, [isHydrated]);
}
