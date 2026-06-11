"use client";

import { useEffect, useState } from "react";
import { ActiveRoutes } from "@/components/ActiveRoutes";
import { ErrorState } from "@/components/ErrorState";
import { SharedRouteWarningBanner } from "@/components/SharedRouteWarningBanner";
import { Footer } from "@/components/Footer";
import { HelpPanel } from "@/components/HelpPanel";
import { RouteSearch } from "@/components/RouteSearch";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useRoutesFromUrl } from "@/hooks/useRoutesFromUrl";
import {
  migrateFavouriteRoutes,
  removeFavouriteRoute,
  toggleFavouriteRoute,
  type FavouriteRoute,
} from "@/lib/favouriteRoutes";
import { formatFriendlyError } from "@/lib/errors";
import {
  normalizeAlertPreferencesMap,
  type RouteAlertPreferences,
} from "@/lib/routeAlerts";
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
  const [urlLoadWarning, setUrlLoadWarning] = useState<{
    title: string;
    message: string;
    action?: string;
  } | null>(null);
  const isOnline = useOnlineStatus();

  const isHydrated =
    activeHydrated && recentHydrated && favouritesHydrated && alertsHydrated;

  useEffect(() => {
    if (!favouritesHydrated) {
      return;
    }
    setFavouriteRoutes((current) => migrateFavouriteRoutes(current));
  }, [favouritesHydrated, setFavouriteRoutes]);

  useEffect(() => {
    if (!alertsHydrated) {
      return;
    }
    setAlertPreferences((current) => normalizeAlertPreferencesMap(current));
  }, [alertsHydrated, setAlertPreferences]);

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

  const handleToggleFavourite = (route: Pick<ActiveRoute, "routeId" | "routeName">) => {
    setFavouriteRoutes((current) =>
      toggleFavouriteRoute(migrateFavouriteRoutes(current), route),
    );
  };

  const handleRemoveFavourite = (routeId: string) => {
    setFavouriteRoutes((current) =>
      removeFavouriteRoute(migrateFavouriteRoutes(current), routeId),
    );
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

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              London Bus Tracker
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Live schematic route loops and detailed stop-by-stop predictions.
            </p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-2 py-6 sm:px-4">
        {isHydrated ? (
          <>
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
              favouriteRoutes={migrateFavouriteRoutes(favouriteRoutes)}
              onActiveRoutesChange={setActiveRoutes}
              onRecentRoutesChange={setRecentRoutes}
              onRemoveFavourite={handleRemoveFavourite}
            />
            <ActiveRoutes
              activeRoutes={activeRoutes}
              favouriteRoutes={migrateFavouriteRoutes(favouriteRoutes)}
              alertPreferences={normalizeAlertPreferencesMap(alertPreferences)}
              onActiveRoutesChange={setActiveRoutes}
              onToggleFavourite={handleToggleFavourite}
              onAlertPreferencesChange={handleAlertPreferencesChange}
            />
            <HelpPanel />
          </>
        ) : (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            Loading saved routes…
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
