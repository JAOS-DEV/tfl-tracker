"use client";

import { useCallback, useEffect, startTransition, useState } from "react";
import { ActiveRoutes } from "@/components/ActiveRoutes";
import { ErrorState } from "@/components/ErrorState";
import { SettingsPanel } from "@/components/SettingsPanel";
import { SharedRouteWarningBanner } from "@/components/SharedRouteWarningBanner";
import { Footer } from "@/components/Footer";
import { InstallAppBanner } from "@/components/InstallAppBanner";
import { RouteSearch } from "@/components/RouteSearch";
import { StopArrivalsModal } from "@/components/StopArrivalsModal";
import { useDisplaySettings } from "@/hooks/useDisplaySettings";
import { useFavouriteStops } from "@/hooks/useFavouriteStops";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useRoutesFromUrl } from "@/hooks/useRoutesFromUrl";
import { useStopFromUrl } from "@/hooks/useStopFromUrl";
import { useViewFromUrl } from "@/hooks/useViewFromUrl";
import { normalizeDisplaySettings } from "@/lib/displaySettings";
import {
  migrateFavouriteRoutes,
  removeFavouriteRoute,
  toggleFavouriteRoute,
  isFavouriteRoute,
  type FavouriteRoute,
} from "@/lib/favouriteRoutes";
import { isFavouriteStop as checkFavouriteStop } from "@/lib/favouriteStops";
import { formatFriendlyError } from "@/lib/errors";
import {
  normalizeAlertPreferencesMap,
  type RouteAlertPreferences,
} from "@/lib/routeAlerts";
import type { StopDetailTarget } from "@/lib/stopDetail";
import {
  MAX_ACTIVE_ROUTES,
  addActiveRoute,
  addRecentRoute,
  createActiveRoute,
} from "@/lib/storage";
import type { ActiveRoute } from "@/lib/tfl/types";
import { STORAGE_KEYS } from "@/lib/storage";

const EMPTY_ACTIVE_ROUTES: ActiveRoute[] = [];
const EMPTY_RECENT_ROUTES: ActiveRoute[] = [];
const EMPTY_FAVOURITES: FavouriteRoute[] = [];
const EMPTY_ALERT_PREFERENCES: Record<string, RouteAlertPreferences> = {};

export default function HomePage(): React.ReactElement {
  const [activeRoutes, setActiveRoutes, activeHydrated] = useLocalStorage(
    STORAGE_KEYS.activeRoutes,
    EMPTY_ACTIVE_ROUTES,
  );
  const [recentRoutes, setRecentRoutes, recentHydrated] = useLocalStorage(
    STORAGE_KEYS.recentRoutes,
    EMPTY_RECENT_ROUTES,
  );
  const [favouriteRoutes, setFavouriteRoutes, favouritesHydrated] =
    useLocalStorage(STORAGE_KEYS.favouriteRoutes, EMPTY_FAVOURITES);
  const [alertPreferences, setAlertPreferences, alertsHydrated] =
    useLocalStorage(
      STORAGE_KEYS.routeAlertPreferences,
      EMPTY_ALERT_PREFERENCES,
    );
  const [displaySettings, , displayHydrated] = useDisplaySettings();
  const {
    favouriteStops,
    isHydrated: favouriteStopsHydrated,
    toggleFavourite: toggleFavouriteStop,
    removeFavourite: removeFavouriteStop,
    clearFavourites: clearFavouriteStops,
  } = useFavouriteStops();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedStop, setSelectedStop] = useState<StopDetailTarget | null>(null);
  const [urlLoadWarning, setUrlLoadWarning] = useState<{
    title: string;
    message: string;
    action?: string;
  } | null>(null);
  const isOnline = useOnlineStatus();

  const isHydrated =
    activeHydrated &&
    recentHydrated &&
    favouritesHydrated &&
    alertsHydrated &&
    displayHydrated &&
    favouriteStopsHydrated;

  const urlVisualMode = useViewFromUrl(isHydrated);

  useEffect(() => {
    if (!favouritesHydrated) {
      return;
    }
    setFavouriteRoutes((current) => migrateFavouriteRoutes(current));
  }, [favouritesHydrated, setFavouriteRoutes]);

  useRoutesFromUrl({
    isHydrated,
    activeRoutes,
    onActiveRoutesChange: setActiveRoutes,
    onRecentRoutesChange: setRecentRoutes,
    onUrlLoadError: (invalidRouteIds) => {
      const friendly = formatFriendlyError(null, { invalidRouteIds });
      setUrlLoadWarning({
        title: friendly.title,
        message: friendly.message,
        action: friendly.action,
      });
    },
  });

  const handleOpenStop = useCallback((stop: StopDetailTarget) => {
    setSelectedStop(stop);
  }, []);

  useStopFromUrl({
    isHydrated,
    favouriteStops,
    onOpenStop: handleOpenStop,
  });

  const migratedFavourites = migrateFavouriteRoutes(favouriteRoutes);

  const handleToggleFavouriteRoute = (
    route: Pick<ActiveRoute, "routeId" | "routeName">,
  ) => {
    setFavouriteRoutes((current) =>
      toggleFavouriteRoute(migrateFavouriteRoutes(current), route),
    );
  };

  const handleRemoveFavouriteRoute = (routeId: string) => {
    setFavouriteRoutes((current) =>
      removeFavouriteRoute(migrateFavouriteRoutes(current), routeId),
    );
  };

  const handleAddRouteFromStop = (routeId: string, routeName: string) => {
    if (activeRoutes.some((route) => route.routeId === routeId)) {
      return;
    }
    if (activeRoutes.length >= MAX_ACTIVE_ROUTES) {
      return;
    }

    const route = createActiveRoute(routeId, routeName);
    setActiveRoutes(addActiveRoute(activeRoutes, route));
    setRecentRoutes(addRecentRoute(recentRoutes, route));
  };

  const handleAlertPreferencesChange = (preferences: RouteAlertPreferences) => {
    setAlertPreferences((current) => ({
      ...normalizeAlertPreferencesMap(current),
      [preferences.routeId]: preferences,
    }));
  };

  const offlineError = !isOnline
    ? formatFriendlyError(null, { isOffline: true })
    : null;

  const normalizedDisplaySettings = normalizeDisplaySettings(displaySettings);
  const savedDataLoading = !isHydrated;

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              London Bus Tracker
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Live bus routes at a glance — tap a route for details.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="min-h-11 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Settings
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-2 py-6 sm:px-4">
        <InstallAppBanner />
        {offlineError ? (
          <ErrorState
            title={offlineError.title}
            message={offlineError.message}
            action={offlineError.action}
          />
        ) : null}

        {urlLoadWarning ? (
          <SharedRouteWarningBanner
            title={urlLoadWarning.title}
            message={urlLoadWarning.message}
            action={urlLoadWarning.action}
            onDismiss={() => setUrlLoadWarning(null)}
          />
        ) : null}

        <RouteSearch
          activeRoutes={activeRoutes}
          recentRoutes={recentRoutes}
          favouriteRoutes={migratedFavourites}
          favouriteStops={favouriteStops}
          defaultView={normalizedDisplaySettings.defaultVisualMode}
          onActiveRoutesChange={setActiveRoutes}
          onRecentRoutesChange={setRecentRoutes}
          onRemoveFavouriteRoute={handleRemoveFavouriteRoute}
          onToggleFavouriteRoute={handleToggleFavouriteRoute}
          onToggleFavouriteStop={toggleFavouriteStop}
          onRemoveFavouriteStop={removeFavouriteStop}
          onOpenStop={handleOpenStop}
          isFavouriteRoute={(routeId) =>
            isFavouriteRoute(migratedFavourites, routeId)
          }
          isFavouriteStop={(stopPointId) =>
            checkFavouriteStop(favouriteStops, stopPointId)
          }
          isLoadingSavedData={savedDataLoading}
        />

        {savedDataLoading ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            Loading saved routes and favourites…
          </div>
        ) : (
          <ActiveRoutes
            activeRoutes={activeRoutes}
            favouriteRoutes={migratedFavourites}
            alertPreferences={normalizeAlertPreferencesMap(alertPreferences)}
            displaySettings={normalizedDisplaySettings}
            urlVisualMode={urlVisualMode}
            onActiveRoutesChange={setActiveRoutes}
            onToggleFavourite={handleToggleFavouriteRoute}
            onAlertPreferencesChange={handleAlertPreferencesChange}
          />
        )}
      </main>

      <Footer />

      <StopArrivalsModal
        stop={selectedStop}
        activeRouteIds={activeRoutes.map((route) => route.routeId)}
        isFavourite={
          selectedStop
            ? checkFavouriteStop(favouriteStops, selectedStop.stopPointId)
            : false
        }
        onToggleFavourite={
          selectedStop
            ? () =>
                toggleFavouriteStop({
                  stopPointId: selectedStop.stopPointId,
                  name: selectedStop.name,
                  stopLetter: selectedStop.stopLetter,
                  routesServed: selectedStop.routesServed,
                })
            : undefined
        }
        onAddRoute={handleAddRouteFromStop}
        onClose={() => setSelectedStop(null)}
      />

      {settingsOpen ? (
        <SettingsPanel
          isOpen={settingsOpen}
          onClose={() => {
            startTransition(() => setSettingsOpen(false));
          }}
          favouriteStops={favouriteStops}
          onClearFavouriteStops={clearFavouriteStops}
        />
      ) : null}
    </div>
  );
}
