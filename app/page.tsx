"use client";

import { useEffect } from "react";
import { ActiveRoutes } from "@/components/ActiveRoutes";
import { Footer } from "@/components/Footer";
import { HelpPanel } from "@/components/HelpPanel";
import { RouteSearch } from "@/components/RouteSearch";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  syncRoutesToUrl,
  useRoutesFromUrl,
} from "@/hooks/useRoutesFromUrl";
import type { ActiveRoute } from "@/lib/tfl/types";
import { STORAGE_KEYS, toggleFavouriteRoute } from "@/lib/storage";

const EMPTY_ACTIVE_ROUTES: ActiveRoute[] = [];
const EMPTY_RECENT_ROUTES: ActiveRoute[] = [];
const EMPTY_FAVOURITES: string[] = [];

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

  const isHydrated = activeHydrated && recentHydrated && favouritesHydrated;

  useRoutesFromUrl({
    isHydrated,
    activeRoutes,
    onActiveRoutesChange: setActiveRoutes,
    onRecentRoutesChange: setRecentRoutes,
  });

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    syncRoutesToUrl(activeRoutes);
  }, [activeRoutes, isHydrated]);

  const handleToggleFavourite = (routeId: string) => {
    setFavouriteRoutes((current) => toggleFavouriteRoute(current, routeId));
  };

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
            <RouteSearch
              activeRoutes={activeRoutes}
              recentRoutes={recentRoutes}
              favouriteRoutes={favouriteRoutes}
              onActiveRoutesChange={setActiveRoutes}
              onRecentRoutesChange={setRecentRoutes}
              onToggleFavourite={handleToggleFavourite}
            />
            <ActiveRoutes
              activeRoutes={activeRoutes}
              favouriteRoutes={favouriteRoutes}
              onActiveRoutesChange={setActiveRoutes}
              onToggleFavourite={handleToggleFavourite}
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
