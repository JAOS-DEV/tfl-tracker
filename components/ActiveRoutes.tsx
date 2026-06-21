"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { RouteCard } from "@/components/RouteCard";
import { MultiRouteDashboard } from "@/components/MultiRouteDashboard";
import { ShareLinkButton } from "@/components/ShareLinkButton";
import type { DisplaySettings } from "@/lib/displaySettings";
import type { FavouriteRoute } from "@/lib/favouriteRoutes";
import { isFavouriteRoute } from "@/lib/favouriteRoutes";
import type { RouteAlertPreferences } from "@/lib/routeAlerts";
import {
  areAllRoutesExpanded,
  isRouteExpanded,
  mergeRouteExpansionState,
  setAllRoutesExpanded,
  type RouteExpansionState,
} from "@/lib/routeCardExpansion";
import { buildRoutesSearchUrl } from "@/lib/routeUrl";
import type { ActiveRoute, RouteVisualMode } from "@/lib/tfl/types";
import type { VehicleSearchFocus } from "@/lib/vehicleSearch";

interface ActiveRoutesProps {
  activeRoutes: ActiveRoute[];
  favouriteRoutes: FavouriteRoute[];
  alertPreferences: Record<string, RouteAlertPreferences>;
  displaySettings: DisplaySettings;
  urlVisualMode?: RouteVisualMode;
  onActiveRoutesChange: (routes: ActiveRoute[]) => void;
  onToggleFavourite: (route: Pick<ActiveRoute, "routeId" | "routeName">) => void;
  onAlertPreferencesChange: (preferences: RouteAlertPreferences) => void;
  pendingVehicleFocus: VehicleSearchFocus | null;
  onPendingVehicleFocusHandled: () => void;
}

export const ActiveRoutes = memo(function ActiveRoutes({
  activeRoutes,
  favouriteRoutes,
  alertPreferences,
  displaySettings,
  urlVisualMode,
  onActiveRoutesChange,
  onToggleFavourite,
  onAlertPreferencesChange,
  pendingVehicleFocus,
  onPendingVehicleFocusHandled,
}: ActiveRoutesProps): React.ReactElement {
  const routeIds = useMemo(
    () => activeRoutes.map((route) => route.routeId),
    [activeRoutes],
  );
  const [expansionOverrides, setExpansionOverrides] = useState<RouteExpansionState>(
    {},
  );
  const expandedByRouteId = useMemo(
    () => mergeRouteExpansionState(expansionOverrides, routeIds),
    [expansionOverrides, routeIds],
  );

  const allRoutesExpanded = areAllRoutesExpanded(expandedByRouteId, routeIds);
  const handleRemove = useCallback(
    (routeId: string) => {
      onActiveRoutesChange(
        activeRoutes.filter((route) => route.routeId !== routeId),
      );
    },
    [activeRoutes, onActiveRoutesChange],
  );

  const handleClearAll = useCallback(() => {
    onActiveRoutesChange([]);
  }, [onActiveRoutesChange]);

  const handleToggleAllExpanded = useCallback(() => {
    setExpansionOverrides(setAllRoutesExpanded(routeIds, !allRoutesExpanded));
  }, [allRoutesExpanded, routeIds]);

  const handleRouteExpandedChange = useCallback((routeId: string, expanded: boolean) => {
    setExpansionOverrides((current) => ({
      ...current,
      [routeId]: expanded,
    }));
  }, []);

  useEffect(() => {
    if (!pendingVehicleFocus) {
      return;
    }

    const routeIndex = routeIds.indexOf(pendingVehicleFocus.routeId);
    if (routeIndex < 0) {
      return;
    }

    if (
      !isRouteExpanded(
        expandedByRouteId,
        pendingVehicleFocus.routeId,
        routeIndex,
        routeIds.length,
      )
    ) {
      setExpansionOverrides((current) => ({
        ...current,
        [pendingVehicleFocus.routeId]: true,
      }));
    }
  }, [expandedByRouteId, pendingVehicleFocus, routeIds]);

  const shareUrl = useMemo(() => {
    const view = urlVisualMode ?? displaySettings.defaultVisualMode;
    const path = buildRoutesSearchUrl(
      activeRoutes.map((route) => route.routeId),
      view,
    );

    if (typeof window === "undefined") {
      return path;
    }

    return new URL(path, window.location.origin).toString();
  }, [activeRoutes, displaySettings.defaultVisualMode, urlVisualMode]);

  if (activeRoutes.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          No active routes yet
        </h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Add a London bus route above to see the schematic loop or detailed
          stop list.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <MultiRouteDashboard
        activeRoutes={activeRoutes}
        alertPreferences={alertPreferences}
        displaySettings={displaySettings}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Active routes ({activeRoutes.length})
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleToggleAllExpanded}
            className="min-h-11 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            {allRoutesExpanded ? "Collapse all" : "Expand all"}
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            className="min-h-11 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Clear all
          </button>
        </div>
      </div>

      <ShareLinkButton url={shareUrl} label="Share active routes" />

      <div className="grid min-w-0 gap-4 xl:grid-cols-1">
        {activeRoutes.map((route, index) => (
          <RouteCard
            key={route.routeId}
            activeRoute={route}
            allActiveRoutes={activeRoutes}
            displaySettings={displaySettings}
            initialVisualMode={urlVisualMode}
            onRemove={handleRemove}
            isFavourite={isFavouriteRoute(favouriteRoutes, route.routeId)}
            onToggleFavourite={onToggleFavourite}
            alertPreferences={alertPreferences[route.routeId]}
            onAlertPreferencesChange={onAlertPreferencesChange}
            isExpanded={isRouteExpanded(
              expandedByRouteId,
              route.routeId,
              index,
              activeRoutes.length,
            )}
            onExpandedChange={handleRouteExpandedChange}
            pendingVehicleFocus={
              pendingVehicleFocus?.routeId === route.routeId
                ? pendingVehicleFocus
                : null
            }
            onPendingVehicleFocusHandled={onPendingVehicleFocusHandled}
          />
        ))}
      </div>
    </section>
  );
});
